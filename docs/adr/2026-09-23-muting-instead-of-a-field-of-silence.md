# Muting the accompaniment instead of a field of silence

Date: 2026-09-23 · Status: accepted, supersedes part of 2026-09-22-chord-is-a-state

## Context

The map used to carry a field called _einstimmig_ ("monophonic") that switched the accompaniment off. But the chosen
chord does more than sound: it decides the width and the colour of every stripe. Choosing silence therefore took away
the very thing the right hand reads — with nothing chosen, the field had nothing to measure against and fell back to
the tonic behind the player's back.

## Decision

A chord is always chosen. Tapping the one that is already sounding mutes the accompaniment; tapping it again brings it
back. Muted, the spot is drawn as an outline in its own colour: clearly still the chord in charge, clearly not being
heard.

Nothing automatic may undo that decision. The auto-harmony and the band move the chord along, but a muted
accompaniment stays muted until a hand says otherwise.

## Why

Two things were tangled in one control: which harmony the field is in, and whether it sounds. Separating them lets a
player play unaccompanied without losing the colours — and it removes a spot that looked like a chord but was not one.

Tapping the chosen chord is the gesture that was free: it did nothing before, it is where the finger already is, and
it works the same way a press-to-latch button does.

## Rejected

_A checkbox in the settings._ Two taps and a panel away from the hand that is playing, for something that belongs in
the flow of playing.

_A separate on/off button beside the map._ One more permanent thing on screen for a state that already has a place.

_Keeping the field of silence and deriving the colours from the tonic._ That is what it did, and it was wrong: the
field showed a harmony nobody had chosen.
