# Every style gets its own chord map

Date: 2026-09-22 · Status: accepted

## Context

A single harmonic layout for all styles forces every scale into functional major-minor
harmony, where most of them do not belong.

## Decision

Each style carries its own list of chords with position and function. Blues gets three seventh
chords including the tonic; dorian gets its major subdominant; phrygian gets the major chord
on the flattened second where a dominant would otherwise be; harmonic minor gets its
diminished seventh; whole tone gets the only two augmented triads that exist in it.

## Why

The characteristic chord _is_ the style. A dorian tonic with a minor subdominant is just
aeolian; the major subdominant is the whole point. Offering a slice of the circle of fifths for
blues would be actively misleading, since blues has no leading note and the tonic itself is a
seventh chord.

## Rejected

_One map, filtered per scale._ Produces empty spots and silently wrong functions, and it cannot
express that a chord means something different in another style.
