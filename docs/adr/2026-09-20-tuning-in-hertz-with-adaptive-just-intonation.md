# Theory computes hertz, audio plays hertz

Date: 2026-09-20 · Status: accepted

## Context

Just, Pythagorean, meantone and adaptive tuning should be musically correct, not one fixed frequency per key.

## Decision

Reference is the root of the key at equal-tempered pitch. Every tuning is a ratio function; styles bring their own
ratios (blues septimal 7/4, 7/5). "Adaptive just" tunes every chord justly from its root (4:5:6:7) because the
instrument knows the chord. Default remains equal temperament. The audio layer knows no MIDI numbers.

## Consequences

Samplers apply frequencies via `playbackRate`; cent deviations can be displayed. MIDI out (12-TET) would only be an
addition.

## Rejected

_MIDI numbers down to the audio layer._ They cannot express a just third, so every historical tuning would
have stopped at the keyboard's compromise.

_One fixed frequency table per key._ It sounds right for one chord and sour for the next; the field knows
which chord is sounding, so it can do better.
