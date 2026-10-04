# Violin timbre model

`violin.bin` holds the weights of a small network (15 721 parameters, little-endian f32) that predicts, for every
moment of a bowed note, the levels of 60 partials and 40 noise bands from three controls: pitch, dynamics and the
time since the bow started. The synth turns those levels into sound (`src/model.rs`, `src/voice.rs`).

It was trained on the solo violin (Arco Vib) of [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), which is
released under CC0 1.0: 15 pitches, played piano and forte. No sample is shipped;
only the weights are.

`violin-reference.bin` holds a few inputs with the network's outputs as computed in Python; the unit tests check the
Rust implementation against them. Both files are written by `tools/violin-model/export.py`.
