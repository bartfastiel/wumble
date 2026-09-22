# A chord is a state, not an event

## Context

When a chord is only struck and then decays, the player has to keep re-striking it to have
anything under the melody. That is busywork and it fights the melody hand.

## Decision

The chosen chord keeps sounding until another one is chosen. Releasing the finger changes
nothing at all — no fade, no level change, no switch to a different voice.

A field called _einstimmig_ ("monophonic") next to the tonic turns the accompaniment off.

## Why

The player asked for exactly this after an earlier version faded the held chord back to a drone
on release: any change on release feels like a bug, because the hand leaving the screen is not
a musical gesture.

Silence needs to be a place on the map, not the absence of a choice. Otherwise there is no way
to play unaccompanied on purpose.

## Rejected

_A permanent drone on the key's root._ Sounded like a stuck test tone and was mistaken for a
defect. A drone also fixes the harmony to the tonic, which is the opposite of what the chord
map is for.
