# The map learns from what is played

Date: 2026-09-22 · Status: accepted

## Context

Rules can say which chord is a plausible next step — common tones, falling fifths, the way home.
They cannot know that this particular player keeps returning to one turn of phrase.

## Decision

Chord size on the map combines the rule-based pull with a count of transitions the player has
actually made. Every chord change is counted; frequent transitions grow their target, with
diminishing returns, over a memory of the last forty chords.

## Why

The suggestion should be an offer, not a verdict. Rules alone make every player's map identical;
history alone would be erratic at the start. Together, the map begins as theory and gradually
becomes a portrait of what this player does.

Growth is capped so that a habit can never hide the theoretically sound options entirely.

## Rejected

_A trained model of chord progressions._ More accurate and not worth a dependency, a download,
or the inability to explain on request why a chord is being suggested.
