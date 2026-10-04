//! A small room around the violin: four combs and two allpasses per side (Schroeder–Moorer, Freeverb tunings).

const COMBS: [usize; 4] = [1116, 1188, 1277, 1356];
const ALLPASSES: [usize; 2] = [556, 441];
const SPREAD: usize = 23;
const FEEDBACK: f32 = 0.82;
const DAMPING: f32 = 0.25;

struct Comb {
    buffer: Vec<f32>,
    index: usize,
    store: f32,
}

impl Comb {
    fn tick(&mut self, input: f32) -> f32 {
        let out = self.buffer[self.index];
        self.store = out * (1.0 - DAMPING) + self.store * DAMPING;
        self.buffer[self.index] = input + self.store * FEEDBACK;
        self.index = (self.index + 1) % self.buffer.len();
        out
    }
}

struct Allpass {
    buffer: Vec<f32>,
    index: usize,
}

impl Allpass {
    fn tick(&mut self, input: f32) -> f32 {
        let delayed = self.buffer[self.index];
        self.buffer[self.index] = input + delayed * 0.5;
        self.index = (self.index + 1) % self.buffer.len();
        delayed - input
    }
}

struct Side {
    combs: Vec<Comb>,
    allpasses: Vec<Allpass>,
}

impl Side {
    fn new(rate: f32, spread: usize) -> Side {
        let scale = |n: usize| (((n + spread) as f32) * rate / 44100.0) as usize;
        Side {
            combs: COMBS.iter().map(|n| Comb { buffer: vec![0.0; scale(*n)], index: 0, store: 0.0 }).collect(),
            allpasses: ALLPASSES.iter().map(|n| Allpass { buffer: vec![0.0; scale(*n)], index: 0 }).collect(),
        }
    }

    fn tick(&mut self, input: f32) -> f32 {
        let mut out = self.combs.iter_mut().map(|c| c.tick(input)).sum::<f32>();
        for a in &mut self.allpasses {
            out = a.tick(out);
        }
        out
    }
}

pub struct Reverb {
    left: Side,
    right: Side,
}

impl Reverb {
    pub fn new(rate: f32) -> Reverb {
        Reverb { left: Side::new(rate, 0), right: Side::new(rate, SPREAD) }
    }

    /// Mono in, the wet signal out on both sides.
    pub fn render(&mut self, input: &[f32], left: &mut [f32], right: &mut [f32], wet: f32) {
        let gain = wet * 0.12;
        for ((x, l), r) in input.iter().zip(left.iter_mut()).zip(right.iter_mut()) {
            *l = self.left.tick(*x) * gain;
            *r = self.right.tick(*x) * gain;
        }
    }
}
