//! The sound engine of Wumble, compiled to WebAssembly and run inside an AudioWorklet.
//!
//! The page writes what every finger does into a block of controls and calls `wumble_render` once per audio quantum;
//! the engine never allocates after `wumble_init`. Layouts of the control and meter blocks are mirrored in
//! `src/next/engine/layout.ts`.

pub mod model;
pub mod noise;
pub mod reverb;
pub mod voice;

use model::Model;
use noise::Shaper;
use reverb::Reverb;
use voice::{Sine, Target, Voice};

pub const VOICES: usize = 8;
pub const VOICE_STRIDE: usize = 6; // gate, note, midi, dynamics, vibrato rate, vibrato depth
pub const GLOBALS: usize = VOICES * VOICE_STRIDE; // volume, reverb
pub const CONTROL_LEN: usize = GLOBALS + 2;
pub const METER_STRIDE: usize = 4; // level, dynamics, active, vibrato phase
pub const METER_LEN: usize = VOICES * METER_STRIDE + 1; // + output peak
pub const BLOCK: usize = 128;

const WEIGHTS: &[u8] = include_bytes!("../model/violin.bin");
const OUTPUT_GAIN: f32 = 2.5; // a single forte note at about -14 dBFS RMS: room for chords before the ceiling

pub struct Engine {
    rate: f32,
    model: Model,
    shaper: Shaper,
    sine: Sine,
    voices: Vec<Voice>,
    reverb: Reverb,
    pub controls: [f32; CONTROL_LEN],
    pub meters: [f32; METER_LEN],
    mono: [f32; BLOCK],
    scratch: [f32; 2 * BLOCK],
    pub left: [f32; BLOCK],
    pub right: [f32; BLOCK],
    wet_left: [f32; BLOCK],
    wet_right: [f32; BLOCK],
}

// A soft ceiling: transparent below about -6 dBFS, never above 1
fn saturate(x: f32) -> f32 {
    let x = x.clamp(-3.0, 3.0);
    (x * (27.0 + x * x) / (27.0 + 9.0 * x * x)).clamp(-1.0, 1.0)
}

impl Engine {
    pub fn new(rate: f32) -> Engine {
        let mut controls = [0.0; CONTROL_LEN];
        controls[GLOBALS] = 1.0;
        controls[GLOBALS + 1] = 0.35;
        Engine {
            rate,
            model: Model::from_le_bytes(WEIGHTS),
            shaper: Shaper::new(rate),
            sine: Sine::new(),
            voices: (0..VOICES).map(Voice::new).collect(),
            reverb: Reverb::new(rate),
            controls,
            meters: [0.0; METER_LEN],
            mono: [0.0; BLOCK],
            scratch: [0.0; 2 * BLOCK],
            left: [0.0; BLOCK],
            right: [0.0; BLOCK],
            wet_left: [0.0; BLOCK],
            wet_right: [0.0; BLOCK],
        }
    }

    fn read_controls(&mut self) {
        for (v, voice) in self.voices.iter_mut().enumerate() {
            let c = &self.controls[v * VOICE_STRIDE..(v + 1) * VOICE_STRIDE];
            voice.set(Target {
                gate: c[0] > 0.5,
                note: c[1] as u32,
                midi: c[2],
                dynamics: c[3],
                vibrato_rate: c[4],
                vibrato_depth: c[5],
            });
        }
    }

    /// Renders `frames` samples (at most one block) into `left` and `right`.
    pub fn render(&mut self, frames: usize) {
        let n = frames.min(BLOCK);
        self.read_controls();
        let mono = &mut self.mono[..n];
        mono.fill(0.0);
        for voice in &mut self.voices {
            voice.render(&self.model, &self.shaper, &self.sine, self.rate, mono, &mut self.scratch);
        }
        let volume = self.controls[GLOBALS] * OUTPUT_GAIN;
        let wet = self.controls[GLOBALS + 1];
        self.reverb.render(mono, &mut self.wet_left[..n], &mut self.wet_right[..n], wet);
        let mut peak = 0.0f32;
        let wet_sides = self.wet_left.iter().zip(&self.wet_right);
        let outputs = self.left.iter_mut().zip(self.right.iter_mut());
        for ((x, (wl, wr)), (l, r)) in mono.iter().zip(wet_sides).zip(outputs) {
            let dry = x * (1.0 - 0.4 * wet);
            *l = saturate((dry + wl) * volume);
            *r = saturate((dry + wr) * volume);
            peak = peak.max(l.abs()).max(r.abs());
        }
        for (v, voice) in self.voices.iter().enumerate() {
            let m = voice.meter();
            let out = &mut self.meters[v * METER_STRIDE..(v + 1) * METER_STRIDE];
            out[0] = m.level * volume;
            out[1] = m.dynamics;
            out[2] = if m.active { 1.0 } else { 0.0 };
            out[3] = m.vibrato_phase;
        }
        self.meters[VOICES * METER_STRIDE] = peak;
    }

    pub fn active_voices(&self) -> usize {
        self.voices.iter().filter(|v| v.is_active()).count()
    }
}

// ---- WebAssembly interface -----------------------------------------------------------------------------------
// One engine per AudioWorklet; the worklet is single-threaded, so this cell is only ever touched from one thread.

struct Global(core::cell::UnsafeCell<Option<Engine>>);
// SAFETY: wasm32 without threads – there is exactly one thread
unsafe impl Sync for Global {}
static ENGINE: Global = Global(core::cell::UnsafeCell::new(None));

fn engine() -> &'static mut Engine {
    // SAFETY: single-threaded, and every export below finishes before the next one starts
    unsafe { (*ENGINE.0.get()).as_mut().expect("wumble_init first") }
}

#[no_mangle]
pub extern "C" fn wumble_init(sample_rate: f32) {
    // SAFETY: as in engine()
    unsafe { *ENGINE.0.get() = Some(Engine::new(sample_rate)) };
}

#[no_mangle]
pub extern "C" fn wumble_controls() -> *mut f32 {
    engine().controls.as_mut_ptr()
}

#[no_mangle]
pub extern "C" fn wumble_meters() -> *const f32 {
    engine().meters.as_ptr()
}

#[no_mangle]
pub extern "C" fn wumble_left() -> *const f32 {
    engine().left.as_ptr()
}

#[no_mangle]
pub extern "C" fn wumble_right() -> *const f32 {
    engine().right.as_ptr()
}

#[no_mangle]
pub extern "C" fn wumble_render(frames: u32) {
    engine().render(frames as usize);
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: f32 = 48000.0;

    fn play(engine: &mut Engine, voice: usize, note: u32, midi: f32, dynamics: f32, gate: bool) {
        let c = &mut engine.controls[voice * VOICE_STRIDE..(voice + 1) * VOICE_STRIDE];
        c.copy_from_slice(&[if gate { 1.0 } else { 0.0 }, note as f32, midi, dynamics, 0.0, 0.0]);
    }

    fn run(engine: &mut Engine, seconds: f32) -> Vec<f32> {
        let mut out = Vec::new();
        for _ in 0..(seconds * RATE / BLOCK as f32) as usize {
            engine.render(BLOCK);
            out.extend_from_slice(&engine.left);
        }
        out
    }

    fn rms(x: &[f32]) -> f32 {
        (x.iter().map(|v| v * v).sum::<f32>() / x.len() as f32).sqrt()
    }

    // Fundamental by autocorrelation over a plausible violin range, the peak refined between lags
    fn pitch(x: &[f32]) -> f32 {
        let r = |lag: usize| x.iter().zip(&x[lag..]).map(|(p, q)| p * q).sum::<f32>();
        let (lo, hi) = ((RATE / 2000.0) as usize, (RATE / 150.0) as usize);
        let best = (lo..hi).max_by(|a, b| r(*a).total_cmp(&r(*b))).unwrap();
        let (a, b, c) = (r(best - 1), r(best), r(best + 1));
        let shift = 0.5 * (a - c) / (a - 2.0 * b + c);
        RATE / (best as f32 + shift)
    }

    fn cents(measured: f32, expected: f32) -> f32 {
        1200.0 * (measured / expected).log2()
    }

    #[test]
    fn silence_until_a_finger_comes() {
        let mut engine = Engine::new(RATE);
        let out = run(&mut engine, 0.2);
        assert!(out.iter().all(|x| *x == 0.0));
    }

    #[test]
    fn a_note_sounds_at_its_pitch_and_dies_after_release() {
        let mut engine = Engine::new(RATE);
        engine.controls[GLOBALS + 1] = 0.0; // dry, for the pitch
        play(&mut engine, 0, 1, 69.0, 0.7, true);
        let held = run(&mut engine, 0.8);
        let tail = &held[held.len() - 8192..];
        assert!(rms(tail) > 0.02, "rms {}", rms(tail));
        assert!(cents(pitch(tail), 440.0).abs() < 3.0, "pitch {}", pitch(tail));
        assert!(held.iter().all(|x| x.is_finite() && x.abs() <= 1.0));

        play(&mut engine, 0, 1, 69.0, 0.7, false);
        run(&mut engine, 2.0);
        assert_eq!(engine.active_voices(), 0);
    }

    #[test]
    fn pressing_harder_is_louder() {
        let level = |dynamics: f32| {
            let mut engine = Engine::new(RATE);
            play(&mut engine, 0, 1, 67.0, dynamics, true);
            let out = run(&mut engine, 0.6);
            rms(&out[out.len() - 4800..])
        };
        let (soft, loud) = (level(0.05), level(1.0));
        assert!(loud > 3.0 * soft, "soft {soft} loud {loud}");
    }

    #[test]
    fn swelling_and_fading_never_move_the_pitch() {
        let mut engine = Engine::new(RATE);
        engine.controls[GLOBALS + 1] = 0.0;
        for (i, dynamics) in [0.1, 1.1, 0.0, 0.8].into_iter().enumerate() {
            play(&mut engine, 0, 1, 69.0, dynamics, true);
            let out = run(&mut engine, 0.4);
            let p = pitch(&out[out.len() - 8192..]);
            assert!(cents(p, 440.0).abs() < 3.0, "step {i}: pitch {p}");
        }
    }

    #[test]
    fn vibrato_swings_evenly_around_the_exact_pitch() {
        let mut engine = Engine::new(RATE);
        engine.controls[GLOBALS + 1] = 0.0;
        play(&mut engine, 0, 1, 69.0, 0.6, true);
        engine.controls[4] = 6.0;
        engine.controls[5] = 1.0;
        let out = run(&mut engine, 1.5);
        // short windows follow the swing; over whole cycles (half a second at 6 Hz) they average to the key's pitch
        let windows: Vec<f32> = out[out.len() - 24000..].chunks(1600).map(|w| cents(pitch(w), 440.0)).collect();
        let centre = windows.iter().sum::<f32>() / windows.len() as f32;
        assert!(centre.abs() < 3.0, "centre {centre} cents");
        let (lo, hi) = windows.iter().fold((f32::MAX, f32::MIN), |(lo, hi), c| (lo.min(*c), hi.max(*c)));
        assert!(hi - lo > 8.0, "the pitch did not swing: {lo} … {hi}");
        assert!(lo > -22.0 && hi < 22.0, "swung too far: {lo} … {hi}");
    }

    #[test]
    fn legato_lands_exactly_on_the_next_key() {
        let mut engine = Engine::new(RATE);
        engine.controls[GLOBALS + 1] = 0.0;
        play(&mut engine, 0, 1, 69.0, 0.7, true);
        run(&mut engine, 0.4);
        play(&mut engine, 0, 1, 72.0, 0.7, true); // same stroke, the next key
        let out = run(&mut engine, 0.5);
        let expected = 440.0 * 2f32.powf(3.0 / 12.0);
        let p = pitch(&out[out.len() - 8192..]);

        assert!(cents(p, expected).abs() < 3.0, "pitch {p}, expected {expected}");
    }

    #[test]
    fn eight_fingers_stay_finite_and_below_full_scale() {
        let mut engine = Engine::new(RATE);
        for v in 0..VOICES {
            play(&mut engine, v, v as u32 + 1, 60.0 + 3.0 * v as f32, 1.1, true);
        }
        let out = run(&mut engine, 0.5);
        assert!(out.iter().all(|x| x.is_finite() && x.abs() <= 1.0));
        assert_eq!(engine.active_voices(), VOICES);
    }
}
