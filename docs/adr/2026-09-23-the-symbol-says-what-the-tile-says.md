# The function symbol says what the tile says

Date: 2026-09-23 · Status: accepted

## Context

Every chord of the map carries a name on its tile – Tonika, Dominante, Gegenklang – and, once the labels are turned
on, a Riemann symbol under it. The two came from different tables and disagreed. The tile beside the tonic said
"Gegenklang" while the symbol said `Dp`; both are current names for E minor in C major, but not on the same chord
at the same moment. The minor subdominant said `S`, exactly like the major one, so the label hid the very thing
that makes it worth a tile of its own. And the symbols were looked up by the chord's place in the scale, which
stops meaning anything in a scale that has no seven notes: in the pentatonic style the dominant was labelled `S`
and the subdominant `undefined`.

## Decision

A chord's function is read from how far its root stands above the tonic, not from its index in the scale. The three
main functions are written small where the chord is minor, so the minor subdominant of a major key is `s`. The
chord a third over its function is the Gegenklang and is written `Tg`, which is the name the tile already used.
Where the functions have no simple name for a chord, it keeps its numeral.

## Consequences

`Tg` instead of `Dp`, `s` instead of `S` for the minor subdominant, and the pentatonic and harmonic-series styles
label their chords correctly for the first time. The jazz map's major second degree now reads `II7` rather than
`Sp7`, which agrees with the "zweite Stufe" on its tile.

## Rejected

_`DD` for the major second degree._ Correct as functional analysis – it is the dominant of the dominant – and it
would contradict the map, which puts that chord below the tonic, away from home, as a colour beside the
subdominant. A name that fights the picture teaches the wrong thing.

_Renaming the tile to "Dominantparallele" instead._ Three tiles would then read "Parallele", and the one word that
tells E minor apart from A minor at a glance would be gone.
