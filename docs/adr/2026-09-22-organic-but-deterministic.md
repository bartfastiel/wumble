# Organic shapes, deterministic layout

## Context

Straight vertical dividers are easy to play and dull to look at. Fully organic arrangements are
beautiful and hard to aim at. Both were built and tried.

## Decision

The layout stays deterministic: one stripe per note, left to right by pitch, order never
changes. Everything else is allowed to be irregular — wavy edges, rounded and unequal ends,
individual tilt, gaps of varying width.

Every irregularity is bounded by the space available: a narrow stripe leans less, waves less and
rounds less than a wide one. Shapes therefore never overlap, however restless the field looks.

## Why

The player tested a pebble field and a field of blurred blobs and judged both worse to play than
the stripes, while liking their look. The compromise keeps the part that carries the playing —
fixed positions, predictable widths — and gives up only the straight lines.

Seeded pseudo-randomness keeps every shape identical between sessions, so the field can be
learned by hand.

## Rejected

_A pebble mosaic._ Loveliest of the versions, and unplayable: without a fixed grid the hand has
nothing to aim at.

_Soft blobs blending into each other._ No edges at all meant no targets, and the blur read as a
rendering fault rather than a style.
