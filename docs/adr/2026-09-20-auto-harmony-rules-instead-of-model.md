# Auto-harmony: rules instead of a model, decision after 120 ms

Date: 2026-09-20 · Status: accepted

## Context

When someone plays melody only, the field should pick the chords. Harmonization needs context in both directions; live,
the future is missing.

## Decision

Rule-based: fit of the note to the chord, inertia, transition weights (V→I, ii→V …), preference for primary chords,
cadence. On a non-chord tone the decision waits 120 ms – a short tap is a passing note. Offline (sheet music) the same
weights, greedy with duration and beat position.

## Consequences

Explainable, testable, no model and no training data. Match rate against notated chords ≈ 86 % on children's songs;
deviations are musically defensible.
