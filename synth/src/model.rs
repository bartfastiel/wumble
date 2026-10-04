//! The violin timbre network: controls of a sounding note in, partial and noise levels out.
//!
//! Two small MLPs share the same Fourier-feature encoding of their inputs. The partial network is queried once per
//! partial with the note's controls, the partial's index and its frequency; that is what lets body resonances, which
//! live on the frequency axis, carry over to pitches the training data never had. The noise network sees the
//! controls only. The layout of `violin.bin` is written by `tools/violin-model/export.py`.

pub const PARTIALS: usize = 60;
pub const BANDS: usize = 40;
const HIDDEN: usize = 64;
const OCTAVES: usize = 4; // Fourier features: x, then sin and cos of pi * 2^j * x for j < OCTAVES
const FEATURES: usize = 1 + 2 * OCTAVES;
const PARTIAL_INPUTS: usize = 5; // pitch, dynamics, time, partial index, partial frequency
const NOISE_INPUTS: usize = 3;

/// The three controls of a note, encoded the way the network was trained on them.
#[derive(Clone, Copy, Debug)]
pub struct Controls {
    pub midi: f32,
    pub dynamics: f32, // 0 = piano, 1 = forte; the training data reaches a little beyond both
    pub seconds: f32,  // since the bow started
}

impl Controls {
    fn encoded(&self) -> [f32; 3] {
        let time = (1.0 + self.seconds.max(0.0) / 0.01).ln() / (1.0 + 10.0 / 0.01f32).ln();
        [(self.midi - 72.0) / 18.0, self.dynamics * 2.0 - 1.0, time.min(1.0)]
    }
}

fn fourier(x: f32) -> [f32; FEATURES] {
    let mut out = [0.0; FEATURES];
    out[0] = x;
    let mut scale = core::f32::consts::PI;
    for j in 0..OCTAVES {
        let (s, c) = (scale * x).sin_cos();
        out[1 + 2 * j] = s;
        out[2 + 2 * j] = c;
        scale *= 2.0;
    }
    out
}

#[inline]
fn leaky(v: f32) -> f32 {
    if v > 0.0 {
        v
    } else {
        0.1 * v
    }
}

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
#[inline]
fn dot(a: &[f32], b: &[f32]) -> f32 {
    use core::arch::wasm32::*;
    let n = a.len().min(b.len()) & !3;
    let mut acc = f32x4_splat(0.0);
    let mut i = 0;
    while i < n {
        // SAFETY: i + 4 <= n <= len of both slices; v128_load allows unaligned addresses
        let (va, vb) =
            unsafe { (v128_load(a.as_ptr().add(i) as *const v128), v128_load(b.as_ptr().add(i) as *const v128)) };
        acc = f32x4_add(acc, f32x4_mul(va, vb));
        i += 4;
    }
    let mut sum = f32x4_extract_lane::<0>(acc)
        + f32x4_extract_lane::<1>(acc)
        + f32x4_extract_lane::<2>(acc)
        + f32x4_extract_lane::<3>(acc);
    while i < a.len().min(b.len()) {
        sum += a[i] * b[i];
        i += 1;
    }
    sum
}

#[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
#[inline]
fn dot(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

struct Layer {
    weights: Vec<f32>, // row-major: outputs × inputs
    bias: Vec<f32>,
    inputs: usize,
}

impl Layer {
    fn read(reader: &mut Reader, outputs: usize, inputs: usize) -> Layer {
        let weights = reader.take(outputs * inputs);
        let bias = reader.take(outputs);
        Layer { weights, bias, inputs }
    }

    fn row(&self, o: usize) -> &[f32] {
        &self.weights[o * self.inputs..(o + 1) * self.inputs]
    }

    fn apply(&self, input: &[f32], out: &mut [f32], activate: bool) {
        for (o, value) in out.iter_mut().enumerate() {
            let v = self.bias[o] + dot(self.row(o), input);
            *value = if activate { leaky(v) } else { v };
        }
    }
}

struct Reader<'a> {
    bytes: &'a [u8],
}

impl Reader<'_> {
    fn take(&mut self, count: usize) -> Vec<f32> {
        let (head, rest) = self.bytes.split_at(count * 4);
        self.bytes = rest;
        head.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect()
    }
}

/// Raw network outputs for one frame.
pub struct Frame {
    pub partials: [f32; PARTIALS], // linear amplitude of each partial
    pub noise_db: [f32; BANDS],    // power of each noise band in dB
}

impl Default for Frame {
    fn default() -> Self {
        Frame { partials: [0.0; PARTIALS], noise_db: [-120.0; BANDS] }
    }
}

pub struct Model {
    partial: [Layer; 3],
    noise: [Layer; 3],
    // The first partial layer split by what changes when: the index features are fixed per partial, so their
    // contribution is computed once here; the control features change per frame, the frequency per partial.
    index_part: Vec<[f32; HIDDEN]>,
}

impl Model {
    pub fn from_le_bytes(bytes: &[u8]) -> Model {
        let mut reader = Reader { bytes };
        let partial = [
            Layer::read(&mut reader, HIDDEN, PARTIAL_INPUTS * FEATURES),
            Layer::read(&mut reader, HIDDEN, HIDDEN),
            Layer::read(&mut reader, 1, HIDDEN),
        ];
        let noise = [
            Layer::read(&mut reader, HIDDEN, NOISE_INPUTS * FEATURES),
            Layer::read(&mut reader, HIDDEN, HIDDEN),
            Layer::read(&mut reader, BANDS, HIDDEN),
        ];
        assert!(reader.bytes.is_empty(), "violin.bin has {} bytes too many", reader.bytes.len());
        let index_part = (1..=PARTIALS)
            .map(|k| {
                let f = fourier(k as f32 / PARTIALS as f32);
                let mut out = [0.0; HIDDEN];
                for (h, value) in out.iter_mut().enumerate() {
                    *value = feature_sum(partial[0].row(h), 3, &f);
                }
                out
            })
            .collect();
        Model { partial, noise, index_part }
    }

    /// Partial levels for the first `count` partials (the rest are left at zero) and the noise bands.
    pub fn eval(&self, controls: Controls, count: usize, out: &mut Frame) {
        let c = controls.encoded();
        let features = c.map(fourier);

        let mut base = [0.0f32; HIDDEN];
        for (h, value) in base.iter_mut().enumerate() {
            let row = self.partial[0].row(h);
            *value = self.partial[0].bias[h] + (0..3).map(|i| feature_sum(row, i, &features[i])).sum::<f32>();
        }

        let f0 = 440.0 * ((controls.midi - 69.0) / 12.0).exp2();
        let (mut hidden, mut second) = ([0.0f32; HIDDEN], [0.0f32; HIDDEN]);
        for k in 0..PARTIALS {
            if k >= count {
                out.partials[k] = 0.0;
                continue;
            }
            let frequency = f0 * (k + 1) as f32;
            let log_frequency = fourier((frequency.max(20.0) / 1000.0).log2() / 4.0);
            for (h, value) in hidden.iter_mut().enumerate() {
                let row = self.partial[0].row(h);
                *value = leaky(base[h] + self.index_part[k][h] + feature_sum(row, 4, &log_frequency));
            }
            self.partial[1].apply(&hidden, &mut second, true);
            let level = self.partial[2].bias[0] + dot(self.partial[2].row(0), &second);
            out.partials[k] = 10f32.powf(2.5 * level - 2.5); // trained as (dB + 50) / 50
        }

        let mut input = [0.0f32; NOISE_INPUTS * FEATURES];
        for (block, chunk) in input.chunks_exact_mut(NOISE_INPUTS).enumerate() {
            for (i, value) in chunk.iter_mut().enumerate() {
                *value = features[i][block];
            }
        }
        self.noise[0].apply(&input, &mut hidden, true);
        self.noise[1].apply(&hidden, &mut second, true);
        let mut raw = [0.0f32; BANDS];
        self.noise[2].apply(&second, &mut raw, false);
        for (db, value) in out.noise_db.iter_mut().zip(raw) {
            *db = value * 40.0 - 80.0; // trained as (dB + 80) / 40
        }
    }

    /// The raw outputs for tests against the Python reference.
    #[cfg(test)]
    fn raw(&self, controls: Controls) -> ([f32; PARTIALS], [f32; BANDS]) {
        let mut frame = Frame::default();
        self.eval(controls, PARTIALS, &mut frame);
        let partials = frame.partials.map(|a| (a.log10() + 2.5) / 2.5);
        let noise = frame.noise_db.map(|db| (db + 80.0) / 40.0);
        (partials, noise)
    }
}

// Inputs are laid out feature block by feature block: [x of every input, sin_0 of every input, cos_0 …]. This sums
// the weights of one input across all its blocks.
fn feature_sum(row: &[f32], input: usize, features: &[f32; FEATURES]) -> f32 {
    features.iter().enumerate().map(|(block, f)| row[block * PARTIAL_INPUTS + input] * f).sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    const WEIGHTS: &[u8] = include_bytes!("../model/violin.bin");
    const REFERENCE: &[u8] = include_bytes!("../model/violin-reference.bin");

    fn floats(bytes: &[u8]) -> Vec<f32> {
        bytes.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect()
    }

    #[test]
    fn matches_the_python_reference() {
        let model = Model::from_le_bytes(WEIGHTS);
        let count = u32::from_le_bytes([REFERENCE[0], REFERENCE[1], REFERENCE[2], REFERENCE[3]]) as usize;
        let data = floats(&REFERENCE[4..]);
        let stride = 3 + PARTIALS + BANDS;
        assert_eq!(data.len(), count * stride);
        for case in data.chunks_exact(stride) {
            let controls = Controls { midi: case[0], dynamics: case[1], seconds: case[2] };
            let (partials, noise) = model.raw(controls);
            for (got, want) in partials.iter().zip(&case[3..3 + PARTIALS]) {
                assert!((got - want).abs() < 2e-4, "partial {got} vs {want} for {controls:?}");
            }
            for (got, want) in noise.iter().zip(&case[3 + PARTIALS..]) {
                assert!((got - want).abs() < 2e-4, "noise {got} vs {want} for {controls:?}");
            }
        }
    }

    #[test]
    fn forte_is_louder_and_brighter_than_piano() {
        let model = Model::from_le_bytes(WEIGHTS);
        let mut soft = Frame::default();
        let mut loud = Frame::default();
        model.eval(Controls { midi: 69.0, dynamics: 0.0, seconds: 1.0 }, PARTIALS, &mut soft);
        model.eval(Controls { midi: 69.0, dynamics: 1.0, seconds: 1.0 }, PARTIALS, &mut loud);
        let energy = |f: &Frame| f.partials.iter().map(|a| a * a).sum::<f32>();
        let centroid =
            |f: &Frame| f.partials.iter().enumerate().map(|(k, a)| (k + 1) as f32 * a * a).sum::<f32>() / energy(f);
        assert!(energy(&loud) > 2.0 * energy(&soft));
        assert!(centroid(&loud) > centroid(&soft));
    }

    #[test]
    fn partials_beyond_the_count_stay_silent() {
        let model = Model::from_le_bytes(WEIGHTS);
        let mut frame = Frame::default();
        model.eval(Controls { midi: 84.0, dynamics: 0.5, seconds: 0.5 }, 12, &mut frame);
        assert!(frame.partials[..12].iter().all(|a| *a > 0.0));
        assert!(frame.partials[12..].iter().all(|a| *a == 0.0));
    }
}
