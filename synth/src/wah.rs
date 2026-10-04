//! A wah: a resonant band-pass sweeping from dark to bright, mixed in as far as the hand tilts the device.
//! Topology-preserving state-variable filter (Zavalishin/Simper): stable while its frequency moves every sample.

const LOW: f32 = 350.0;
const HIGH: f32 = 2200.0;
const Q: f32 = 3.5;
const SMOOTHING: f32 = 0.02; // seconds

pub struct Wah {
    rate: f32,
    ic1: f32,
    ic2: f32,
    amount: f32,
    position: f32,
}

impl Wah {
    pub fn new(rate: f32) -> Wah {
        Wah { rate, ic1: 0.0, ic2: 0.0, amount: 0.0, position: 0.0 }
    }

    /// `amount` 0 … 1 (0 = dry), `position` -1 dark … 1 bright.
    pub fn render(&mut self, signal: &mut [f32], amount: f32, position: f32) {
        let follow = 1.0 - (-1.0 / (SMOOTHING * self.rate)).exp();
        let k = 1.0 / Q;
        for x in signal.iter_mut() {
            self.amount += (amount.clamp(0.0, 1.0) - self.amount) * follow;
            self.position += (position.clamp(-1.0, 1.0) - self.position) * follow;
            if self.amount < 1e-4 {
                // keep the filter running so it does not click when it opens
                self.ic1 *= 0.99;
                self.ic2 *= 0.99;
                continue;
            }
            let cutoff = LOW * (HIGH / LOW).powf((self.position + 1.0) * 0.5);
            let g = (core::f32::consts::PI * cutoff / self.rate).tan();
            let a1 = 1.0 / (1.0 + g * (g + k));
            let v3 = *x - self.ic2;
            let v1 = a1 * self.ic1 + g * a1 * v3;
            let v2 = self.ic2 + g * v1;
            self.ic1 = 2.0 * v1 - self.ic1;
            self.ic2 = 2.0 * v2 - self.ic2;
            let band = v1 * k; // unity gain at the centre
            *x += (band * 2.2 - *x) * self.amount;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(freq: f32, rate: f32, n: usize) -> Vec<f32> {
        (0..n).map(|i| (core::f32::consts::TAU * freq * i as f32 / rate).sin()).collect()
    }

    fn rms(x: &[f32]) -> f32 {
        (x.iter().map(|v| v * v).sum::<f32>() / x.len() as f32).sqrt()
    }

    #[test]
    fn closed_it_leaves_the_sound_alone() {
        let mut wah = Wah::new(48000.0);
        let mut x = sine(440.0, 48000.0, 4800);
        let dry = x.clone();
        wah.render(&mut x, 0.0, 0.0);
        assert_eq!(x, dry);
    }

    #[test]
    fn its_position_moves_the_resonance() {
        let level = |position: f32, freq: f32| {
            let mut wah = Wah::new(48000.0);
            let mut x = sine(freq, 48000.0, 24000);
            wah.render(&mut x, 1.0, position);
            rms(&x[12000..])
        };
        assert!(level(-1.0, 350.0) > 2.0 * level(1.0, 350.0));
        assert!(level(1.0, 2200.0) > 2.0 * level(-1.0, 2200.0));
    }
}
