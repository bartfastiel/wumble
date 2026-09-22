# Shaping a held note, without letting it go out of tune

## Context

A held note that cannot be changed is a button, not an instrument. A violinist shapes a note
for its whole length.

## Decision

While a note is held:

- dragging up opens it — brighter and louder; dragging down makes it breathy and quiet
- circling gives vibrato, whose rate and depth follow the rate and size of the circles
- where the stripe is touched sets the starting character: airy near the top, woody near the
  bottom

Vibrato is limited to 17 cents. There is no pitch bend.

## Why

The circling gesture maps a continuous physical motion onto a continuous musical one, which is
what makes it feel like playing rather than operating.

The 17-cent limit is the boundary the player drew after trying free bending: beyond it, the
note stops sounding expressive and starts sounding wrong. A violinist's vibrato stays inside
that range.

## Rejected

_Sideways bending within a key._ Implemented, then removed: it produced out-of-tune notes,
which is exactly what an instrument that cannot be played wrong must not do.
