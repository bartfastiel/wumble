//! One bowed note: the model's levels turned into partials and noise, shaped by what the finger does.
//!
//! The pitch is always centred exactly on the key's: nothing drifts or bends. The one movement it makes is vibrato,
//! as on a real violin – an even swing around that centre, at the rate the finger suggests, with the swell of strength
//! and brightness that comes with it as the partials pass through the body's resonances.

use crate::model::{Controls, Frame, Model, PARTIALS};
use crate::noise::{Noise, Shaper, HOP};

const TABLE: usize = 4096;
const HIGHEST_PARTIAL: f32 = 18000.0; // as in training
const ATTACK: f32 = 0.012; // seconds: only against a click, the bow's own attack is in the model
const RELEASE: f32 = 0.16; // seconds, time constant of the bow leaving the string
const DYNAMICS_SMOOTHING: f32 = 0.02;
// The model spans about 10 dB between piano and forte; the instrument exaggerates that on purpose
pub const EXTRA_RANGE_DB: f32 = 16.0;
const VIBRATO_CENTS: f32 = 15.0; // swing of the pitch either side of the key at full depth
const VIBRATO_DYNAMICS: f32 = 0.08; // swing of the dynamics at full depth
const VIBRATO_SMOOTHING: f32 = 0.05;

/// What the page asks of a voice.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Target {
    pub gate: bool,
    pub note: u32, // a new number starts a new bow stroke
    pub midi: f32,
    pub dynamics: f32,
    pub vibrato_rate: f32,  // Hz
    pub vibrato_depth: f32, // 0 … 1
}

/// What a voice reports back for the picture.
#[derive(Clone, Copy, Debug, Default)]
pub struct Meter {
    pub level: f32,
    pub dynamics: f32,
    pub vibrato_phase: f32, // 0 … 1, so the picture swings with the sound
    pub active: bool,
}

pub struct Sine {
    table: Vec<f32>,
}

impl Sine {
    pub fn new() -> Sine {
        Sine { table: (0..=TABLE).map(|i| (core::f32::consts::TAU * i as f32 / TABLE as f32).sin()).collect() }
    }

    #[inline]
    fn at(&self, phase: f32) -> f32 {
        let x = phase * TABLE as f32;
        let i = x as usize;
        let frac = x - i as f32;
        let a = self.table[i];
        a + (self.table[i + 1] - a) * frac
    }
}

impl Default for Sine {
    fn default() -> Self {
        Self::new()
    }
}

pub struct Voice {
    target: Target,
    note: u32,
    active: bool,
    midi: f32,
    dynamics: f32,
    vibrato_rate: f32,
    vibrato_depth: f32,
    vibrato_phase: f32,
    seconds: f32,
    envelope: f32,
    phase: [f32; PARTIALS],
    amp: [f32; PARTIALS],
    step: [f32; PARTIALS],
    ramp_left: usize,
    until_frame: usize,
    frame: Frame,
    noise: Noise,
    level: f32,
}

impl Voice {
    pub fn new(index: usize) -> Voice {
        Voice {
            target: Target::default(),
            note: 0,
            active: false,
            midi: 69.0,
            dynamics: 0.5,
            vibrato_rate: 0.0,
            vibrato_depth: 0.0,
            vibrato_phase: 0.0,
            seconds: 0.0,
            envelope: 0.0,
            phase: [0.0; PARTIALS],
            amp: [0.0; PARTIALS],
            step: [0.0; PARTIALS],
            ramp_left: 0,
            // Voices compute their frames in different blocks, so a chord does not land in one callback
            until_frame: (index * 64) % HOP,
            frame: Frame::default(),
            noise: Noise::new(0x9E37_79B9 ^ (index as u32 * 0x85EB_CA6B)),
            level: 0.0,
        }
    }

    pub fn set(&mut self, target: Target) {
        if target.gate && (!self.active || target.note != self.note) {
            self.start(target);
        }
        self.target = target;
    }

    fn start(&mut self, target: Target) {
        let restart = !self.active;
        self.note = target.note;
        self.active = true;
        self.seconds = 0.0;
        self.dynamics = target.dynamics;
        self.midi = target.midi;
        if restart {
            self.envelope = 0.0;
            self.amp = [0.0; PARTIALS];
            self.step = [0.0; PARTIALS];
            self.noise.reset();
            // Fixed but different starting phases: no partials adding up to a spike at the onset
            for (k, phase) in self.phase.iter_mut().enumerate() {
                *phase = ((k * 7919) % 1000) as f32 / 1000.0;
            }
        }
        self.until_frame = 0;
    }

    pub fn meter(&self) -> Meter {
        Meter { level: self.level, dynamics: self.dynamics, vibrato_phase: self.vibrato_phase, active: self.active }
    }

    pub fn is_active(&self) -> bool {
        self.active
    }

    /// Adds the next `out.len()` samples to `out`. `scratch` needs room for twice as many samples.
    pub fn render(
        &mut self,
        model: &Model,
        shaper: &Shaper,
        sine: &Sine,
        rate: f32,
        out: &mut [f32],
        scratch: &mut [f32],
    ) {
        if !self.active {
            self.level = 0.0;
            return;
        }
        let n = out.len();
        let seconds = n as f32 / rate;
        let follow = |time: f32| 1.0 - (-seconds / time).exp();
        // Legato onto another key: the bow keeps going, the pitch moves at once – phases run on, so nothing clicks
        self.midi = self.target.midi;
        self.dynamics += (self.target.dynamics - self.dynamics) * follow(DYNAMICS_SMOOTHING);
        self.vibrato_depth += (self.target.vibrato_depth - self.vibrato_depth) * follow(VIBRATO_SMOOTHING);
        if self.target.vibrato_rate > 0.0 {
            self.vibrato_rate = self.target.vibrato_rate;
        }
        self.vibrato_phase = (self.vibrato_phase + self.vibrato_rate * seconds).fract();
        let swing = (core::f32::consts::TAU * self.vibrato_phase).sin() * self.vibrato_depth;
        let dynamics = self.dynamics + swing * VIBRATO_DYNAMICS;
        let midi = self.midi + swing * VIBRATO_CENTS / 100.0;
        let f0 = 440.0 * ((midi - 69.0) / 12.0).exp2();
        let count = ((HIGHEST_PARTIAL.min(rate / 2.0 - 500.0) / f0) as usize).clamp(1, PARTIALS);

        if self.until_frame < n {
            let controls = Controls { midi, dynamics, seconds: self.seconds };
            model.eval(controls, count, &mut self.frame);
            let gain = 10f32.powf((dynamics - 0.5) * EXTRA_RANGE_DB / 20.0);
            for k in 0..PARTIALS {
                self.step[k] = (self.frame.partials[k] * gain - self.amp[k]) / HOP as f32;
            }
            self.ramp_left = HOP;
            self.until_frame += HOP;
        }
        self.until_frame -= n;

        // Envelope per sample, shared by partials and noise
        let (envelope, own) = scratch[..2 * n].split_at_mut(n);
        own.fill(0.0);
        let attack = 1.0 / (ATTACK * rate);
        let release = (-1.0 / (RELEASE * rate)).exp();
        for e in envelope.iter_mut() {
            self.envelope = if self.target.gate { (self.envelope + attack).min(1.0) } else { self.envelope * release };
            *e = self.envelope;
        }

        let ramp = self.ramp_left.min(n);
        for k in 0..count {
            let increment = f0 * (k + 1) as f32 / rate;
            let (mut phase, mut amp, step) = (self.phase[k], self.amp[k], self.step[k]);
            for (i, sample) in own.iter_mut().enumerate() {
                *sample += amp * sine.at(phase) * envelope[i];
                phase += increment;
                if phase >= 1.0 {
                    phase -= 1.0;
                }
                if i < ramp {
                    amp += step;
                }
            }
            self.phase[k] = phase;
            self.amp[k] = amp;
        }
        // Partials above the count fade with their ramp but are not rendered: keep their state honest
        for k in count..PARTIALS {
            self.amp[k] = 0.0;
        }
        self.ramp_left -= ramp;

        let gain = 10f32.powf((dynamics - 0.5) * EXTRA_RANGE_DB / 20.0);
        self.noise.render(shaper, &self.frame.noise_db, gain, own, envelope);

        let mut sum = 0.0f32;
        for (o, v) in out.iter_mut().zip(own.iter()) {
            *o += v;
            sum += v * v;
        }
        self.level = (sum / n as f32).sqrt();
        self.seconds += seconds;
        if !self.target.gate && self.envelope < 1e-4 {
            self.active = false;
            self.level = 0.0;
        }
    }
}
