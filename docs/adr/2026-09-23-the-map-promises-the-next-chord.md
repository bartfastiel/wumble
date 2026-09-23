# The map promises the next chord

Date: 2026-09-23 · Status: accepted

## Context

With a schema running – the twelve-bar blues opens the app – the chord changes by itself at the bar line. Until now
that change simply happened: the lit spot moved, and whoever was playing a phrase over the old chord found themselves
over a new one, mid-note. The information existed (the schema is written down, the bar count is known) and was kept
from the one person who needed it.

## Decision

The chord the schema will play next wears a ring, and the ring closes as the bars run out.

It appears as soon as the next change is in sight – up to eight bars ahead – as a faint outline: _this one is coming_.
The bright part of the ring grows over the whole way there, so at a glance it says both which chord and how far off:
a quarter closed is three bars away, nearly shut means the next bar. In the last beat before the change the glow
swells. The face of the spot takes on a little of the same light, so the eye finds it without hunting for a ring.

Nothing is shown when the band follows the play rather than a schema: there is no future to promise then.

Drawing it needs to know how far the current bar has run. The scheduler reports steps, sixteen to a bar, which would
show as sixteen jumps; a small clock fills the gaps from the wall clock and learns the step length from the steps
themselves.

## Why

Playing with a band is anticipation: you hear the change coming and lean into it. A screen that shows the present
only makes the player react instead of play. This is the same promise the map already makes with the size of its
spots – how likely a chord is – carried one step further to when.

The ring is the shape that says "a duration is running out" without a number, and it closes from the top because
that is where every clock starts.

## Rejected

_A countdown in bars or beats._ A number to read and convert, in a corner of the eye, while both hands are busy.

_Lighting up the next chord as if it were chosen._ Two spots that look chosen is one too many, and the difference
between "sounding now" and "coming" is exactly what must stay clear.

_Showing the whole schema as a strip._ It would need a place of its own on the screen, and it answers a question
nobody asks while playing: what comes after the thing after next.
