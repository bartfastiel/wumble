# A style is data: scale, chord map, just ratios

Date: 2026-09-20 · Status: accepted

## Context

Blues, rock, jazz, the school styles (pentatonic, modes, harmonic minor, whole tone) and the harmonic series all use
the same playing field. What separates them is which tones the field offers and which chords the map holds.

## Decision

A style = the semitone offsets of its scale relative to the root, its chord map (see
[the map per style](2026-09-22-chord-map-per-style.md)), a ratio table for just intonation, and suggestions for sound,
groove and tempo.

## Consequences

New styles are data sets without code. Songs carry their style and switch to it when loaded.

## Rejected

_One scale and chords derived by formula._ It works for major and minor and falls apart at the blues, where the same
scale degree is both a chord tone and a colour.
