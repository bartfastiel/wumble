//! Shaped noise: the bow's hiss and the rosin's grain, filtered to the levels the model asks for.
//!
//! White noise is drawn directly in the frequency domain, shaped band by band, transformed back and overlap-added
//! with a Hann window – the same procedure the model was trained against (frame 1024, hop 256), so the levels mean
//! the same thing here as there.

use crate::model::BANDS;

pub const SIZE: usize = 1024;
pub const HOP: usize = 256;
const BINS: usize = SIZE / 2 + 1;

/// FFT tables and the band-to-bin interpolation, shared by all voices.
pub struct Shaper {
    cos: Vec<f32>,
    sin: Vec<f32>,
    reverse: Vec<u16>,
    window: Vec<f32>,
    // Each bin reads its level between two band centres on a logarithmic frequency axis
    band_low: Vec<u8>,
    band_frac: Vec<f32>,
}

impl Shaper {
    pub fn new(sample_rate: f32) -> Shaper {
        let tau = core::f32::consts::TAU;
        let cos = (0..SIZE / 2).map(|i| (tau * i as f32 / SIZE as f32).cos()).collect();
        let sin = (0..SIZE / 2).map(|i| (tau * i as f32 / SIZE as f32).sin()).collect();
        let bits = SIZE.trailing_zeros();
        let reverse = (0..SIZE).map(|i| ((i as u32).reverse_bits() >> (32 - bits)) as u16).collect();
        let window = (0..SIZE).map(|i| 0.5 - 0.5 * (tau * i as f32 / (SIZE - 1) as f32).cos()).collect();

        // Band edges as in the training analysis: 30 Hz to 20 kHz, geometric
        let edge = |i: usize| 30.0f32 * (20000.0f32 / 30.0).powf(i as f32 / BANDS as f32);
        let centres: Vec<f32> = (0..BANDS).map(|i| (edge(i) * edge(i + 1)).sqrt().ln()).collect();
        let mut band_low = Vec::with_capacity(BINS);
        let mut band_frac = Vec::with_capacity(BINS);
        for bin in 0..BINS {
            let f = (bin as f32 * sample_rate / SIZE as f32).max(1.0).ln();
            let (low, frac) = if f <= centres[0] {
                (0, 0.0)
            } else if f >= centres[BANDS - 1] {
                (BANDS - 2, 1.0)
            } else {
                let i = centres.iter().rposition(|c| *c <= f).unwrap_or(0).min(BANDS - 2);
                (i, (f - centres[i]) / (centres[i + 1] - centres[i]))
            };
            band_low.push(low as u8);
            band_frac.push(frac);
        }
        Shaper { cos, sin, reverse, window, band_low, band_frac }
    }

    fn inverse_fft(&self, re: &mut [f32; SIZE], im: &mut [f32; SIZE]) {
        for i in 0..SIZE {
            let j = self.reverse[i] as usize;
            if j > i {
                re.swap(i, j);
                im.swap(i, j);
            }
        }
        let mut len = 2;
        while len <= SIZE {
            let half = len / 2;
            let step = SIZE / len;
            for start in (0..SIZE).step_by(len) {
                for k in 0..half {
                    // inverse transform: conjugate twiddle
                    let (wr, wi) = (self.cos[k * step], self.sin[k * step]);
                    let (a, b) = (start + k, start + k + half);
                    let tr = re[b] * wr - im[b] * wi;
                    let ti = re[b] * wi + im[b] * wr;
                    re[b] = re[a] - tr;
                    im[b] = im[a] - ti;
                    re[a] += tr;
                    im[a] += ti;
                }
            }
            len *= 2;
        }
    }
}

/// One voice's noise stream.
pub struct Noise {
    seed: u32,
    acc: [f32; SIZE],
    out: [f32; HOP],
    read: usize,
    re: [f32; SIZE],
    im: [f32; SIZE],
}

impl Noise {
    pub fn new(seed: u32) -> Noise {
        Noise { seed: seed | 1, acc: [0.0; SIZE], out: [0.0; HOP], read: HOP, re: [0.0; SIZE], im: [0.0; SIZE] }
    }

    pub fn reset(&mut self) {
        self.acc = [0.0; SIZE];
        self.read = HOP;
    }

    // Approximately normal, variance 1: the sum of four uniforms is close enough for noise
    fn gaussian(&mut self) -> f32 {
        let mut sum = 0.0;
        for _ in 0..4 {
            self.seed ^= self.seed << 13;
            self.seed ^= self.seed >> 17;
            self.seed ^= self.seed << 5;
            sum += self.seed as f32 / u32::MAX as f32;
        }
        (sum - 2.0) * 3.0f32.sqrt()
    }

    fn next_hop(&mut self, shaper: &Shaper, bands_db: &[f32; BANDS], gain: f32) {
        // A real FFT of N white samples has |X|² ≈ N per bin: draw that directly, as a Hermitian spectrum
        let spread = (SIZE as f32 / 2.0).sqrt();
        let amplitude: [f32; BANDS] = bands_db.map(|db| 10f32.powf(db / 20.0) * gain);
        for bin in 0..BINS {
            let low = shaper.band_low[bin] as usize;
            let frac = shaper.band_frac[bin];
            let g = amplitude[low] + (amplitude[low + 1] - amplitude[low]) * frac;
            let (r, i) = (self.gaussian() * spread * g, self.gaussian() * spread * g);
            let edge = bin == 0 || bin == SIZE / 2;
            self.re[bin] = if edge { r * core::f32::consts::SQRT_2 } else { r };
            self.im[bin] = if edge { 0.0 } else { i };
            if !edge {
                self.re[SIZE - bin] = r;
                self.im[SIZE - bin] = -i;
            }
        }
        shaper.inverse_fft(&mut self.re, &mut self.im);
        // irfft scales by 1/N; the overlap of four Hann windows adds 1.5 in power
        let scale = 1.0 / (SIZE as f32 * 1.5f32.sqrt());
        for i in 0..SIZE {
            self.acc[i] += self.re[i] * scale * shaper.window[i];
        }
        self.out.copy_from_slice(&self.acc[..HOP]);
        self.acc.copy_within(HOP.., 0);
        self.acc[SIZE - HOP..].fill(0.0);
        self.read = 0;
    }

    /// Adds `out.len()` samples of shaped noise, each scaled by `envelope`, to `out`.
    pub fn render(&mut self, shaper: &Shaper, bands_db: &[f32; BANDS], gain: f32, out: &mut [f32], envelope: &[f32]) {
        for (sample, env) in out.iter_mut().zip(envelope) {
            if self.read == HOP {
                self.next_hop(shaper, bands_db, gain);
            }
            *sample += self.out[self.read] * env;
            self.read += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_flat_spectrum_gives_noise_of_the_expected_power() {
        // A band level of 0 dB means |X|² = N per bin, i.e. white noise of variance 1 before the 1.5 overlap gain
        let shaper = Shaper::new(44100.0);
        let mut noise = Noise::new(7);
        let bands = [0.0f32; BANDS];
        let mut out = vec![0.0f32; 44100];
        let env = vec![1.0f32; out.len()];
        noise.render(&shaper, &bands, 1.0, &mut out, &env);
        let tail = &out[SIZE..];
        let variance = tail.iter().map(|x| x * x).sum::<f32>() / tail.len() as f32;
        assert!((variance - 1.0).abs() < 0.15, "variance {variance}");
    }

    #[test]
    fn a_silent_spectrum_stays_silent() {
        let shaper = Shaper::new(48000.0);
        let mut noise = Noise::new(3);
        let mut out = vec![0.0f32; 4096];
        let env = vec![1.0f32; out.len()];
        noise.render(&shaper, &[-200.0; BANDS], 1.0, &mut out, &env);
        assert!(out.iter().all(|x| x.abs() < 1e-6));
    }
}
