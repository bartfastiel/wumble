# The second generation starts with a violin in WebGL and WebAssembly

Date: 2026-10-04 · Status: accepted, supersedes the rejection of WebGL and WebAssembly in
[pixels before smoothness](2026-09-23-pixels-before-smoothness.md)

## Context

The first generation grew feature by feature and reached its limits as a product: a dynamic field below and a
conventional menu above, a sound that could only be started and stopped, and a canvas that had to be coaxed into
running smoothly on a phone. The next generation is to be built as one piece and finished to the last detail. Its
first question is the instrument itself: can a note be shaped while it sounds, the way a singer lets a straight tone
grow into vibrato or a violinist swells and fades within one stroke?

## Decision

The second generation lives in `next/`, beside the first, until it can replace it.

- **Picture:** one WebGL 2 canvas, one full-screen triangle, one fragment shader. The keys are white lacquer; a finger
  presses a hollow into it that grows with pressure, light gathers there, and rings run outwards while the note is
  bent.
- **Sound:** a synth in Rust, compiled to WebAssembly, run in an AudioWorklet that allocates nothing while playing.
  Controls go from the pointer straight into memory shared with the audio thread.
- **Violin:** its timbre is a small network (15 721 weights) trained on the CC0 solo violin of VSCO 2: from pitch,
  dynamics and the time since the bow started it predicts 60 partials and 40 noise bands. Loudness therefore changes
  the colour of the tone, not only its level, and a note can do what no recording of it did.
- **The pitch is always centred on the key.** A key sounds exactly its tone in the chosen tuning – no bending, no
  drift, no glide. The one movement is vibrato, as on a real violin: an even swing of at most 15 cents either side of
  that centre, at a rate and depth taken from how often and how far a finger rocks back and forth. A sweep in one
  direction is not vibrato.
- **Expression, exaggerated on purpose for now:** pressure is the bow's weight on devices that report it (a light tap
  plays lightly, a firm one firmly, pressing in swells the note, and easing off counts for more than pressing in,
  because a flattened fingertip relaxes only part of the way back); sliding up and down the key draws harder or
  lighter everywhere; gliding onto a neighbour is legato; the phone
  gives a small tick for each of these. Without pressure, where a key is struck sets how the note begins.
- **Keys:** the right hand only, every tone of the blues scale of C across the violin's range (G3 to C7, 21 keys),
  septimally tuned. The key of the music decides each key's width and brightness: what carries over the tonic's chord
  is wide and white, what pulls narrow and slate, and the tonic carries a blue seam.

## Why

The measurements of the first generation found nothing for WebGL to win because the canvas was already the wrong
tool to measure against: a shader paints light, depth and motion at the cost of a single draw call, which is what an
instrument that reacts to pressure needs to show. For sound the question had never been asked. A sample can only
replay the crescendo that was recorded; a model that is asked a hundred times a second can follow the finger.
Measured on a Pixel 6 Pro, Chrome reports real pressure in 64 steps and pointer samples every 4 ms – enough for a
bow, not for the force of a strike, which no browser reports.

## Rejected

_Samples for the violin._ They cannot change colour with dynamics or develop while held. They stay right for
instruments that cannot be shaped after the strike, such as the piano.

_Pitch that follows the finger._ Built first: the pitch moved with the finger's position, up to 45 cents and with
drift. It was heard as frightening rather than expressive – an instrument whose keys can sound out of tune has lost
the one promise the field makes. A violinist's vibrato is different: it swings evenly around the note, which is why
it came back in that form.

_A large generative model in the browser._ Too heavy for the audio thread of a phone, and the free ones carry
non-commercial licences.

_JavaScript for the synth._ The garbage collector would be heard as dropouts as soon as several fingers play.

_Replacing the first generation in place._ `main` only moves forward; the old app keeps working until the new one is
better.
