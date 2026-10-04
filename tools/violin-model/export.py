"""Export the violin timbre model for the synth crate.

The model maps the controls of a sounding note (pitch, dynamics, time since the bow started) to the levels of 60
partials and 40 noise bands. It was trained on the solo violin of VSCO 2 Community Edition (CC0 1.0).

Usage: python export.py <state_dict.pt> <out_dir>

Writes
  violin.bin            all weights as little-endian f32, in the order the synth reads them (see synth/src/model.rs)
  violin-reference.bin  a few control inputs with the network's raw outputs, for the synth's unit test
"""
import struct
import sys
from pathlib import Path

import numpy as np
import torch

NH, NB = 60, 40
ORDER = [
    'harm.0.weight', 'harm.0.bias', 'harm.2.weight', 'harm.2.bias', 'harm.4.weight', 'harm.4.bias',
    'noise.0.weight', 'noise.0.bias', 'noise.2.weight', 'noise.2.bias', 'noise.4.weight', 'noise.4.bias',
]
SHAPES = {
    'harm.0.weight': (64, 45), 'harm.0.bias': (64,), 'harm.2.weight': (64, 64), 'harm.2.bias': (64,),
    'harm.4.weight': (1, 64), 'harm.4.bias': (1,),
    'noise.0.weight': (64, 27), 'noise.0.bias': (64,), 'noise.2.weight': (64, 64), 'noise.2.bias': (64,),
    'noise.4.weight': (NB, 64), 'noise.4.bias': (NB,),
}


def fourier(x):
    parts = [x]
    for j in range(4):
        parts += [np.sin(np.pi * 2 ** j * x), np.cos(np.pi * 2 ** j * x)]
    return np.concatenate(parts, -1)


def mlp(sd, prefix, x):
    leaky = lambda v: np.where(v > 0, v, 0.1 * v)
    x = leaky(x @ sd[prefix + '.0.weight'].T + sd[prefix + '.0.bias'])
    x = leaky(x @ sd[prefix + '.2.weight'].T + sd[prefix + '.2.bias'])
    return x @ sd[prefix + '.4.weight'].T + sd[prefix + '.4.bias']


def controls(midi, dyn, seconds):
    time = np.log1p(seconds / 0.01) / np.log1p(10.0 / 0.01)
    return np.array([(midi - 72) / 18, dyn * 2 - 1, min(time, 1.0)])


def forward(sd, midi, dyn, seconds):
    c = controls(midi, dyn, seconds)
    f0 = 440 * 2 ** ((midi - 69) / 12)
    k = np.arange(1, NH + 1)
    logf = np.log2(np.maximum(f0 * k, 20) / 1000) / 4
    q = np.concatenate([np.repeat(c[None, :], NH, 0), (k / NH)[:, None], logf[:, None]], 1)
    harm = mlp(sd, 'harm', fourier(q))[:, 0]
    noise = mlp(sd, 'noise', fourier(c[None, :]))[0]
    return harm, noise


def main(src, out):
    sd = {k: v.detach().numpy().astype(np.float64) for k, v in torch.load(src).items()}
    for name in ORDER:
        assert sd[name].shape == SHAPES[name], (name, sd[name].shape)
    out = Path(out)
    with open(out / 'violin.bin', 'wb') as f:
        for name in ORDER:
            f.write(sd[name].astype('<f4').tobytes())
    cases = [(60.0, 0.0, 0.02), (67.0, 0.5, 0.3), (72.3, 1.0, 2.0), (79.0, 0.8, 9.0), (84.0, 0.2, 0.08)]
    with open(out / 'violin-reference.bin', 'wb') as f:
        f.write(struct.pack('<I', len(cases)))
        for midi, dyn, seconds in cases:
            harm, noise = forward(sd, midi, dyn, seconds)
            f.write(np.array([midi, dyn, seconds], '<f4').tobytes())
            f.write(harm.astype('<f4').tobytes())
            f.write(noise.astype('<f4').tobytes())
    print('parameters:', sum(sd[n].size for n in ORDER))


if __name__ == '__main__':
    main(*sys.argv[1:3])
