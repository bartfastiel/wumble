# Music from the first click

Date: 2026-09-23 · Status: accepted

## Context

An instrument that opens silent asks the visitor to find out what to press first. Most of them never do. But a browser
will not let a page make a sound without a gesture, and the speakers may still be turned up from whatever ran before.

## Decision

Every visit opens on a welcome page: the name, one sentence, and three lines saying what the left, the right and the
bottom of the screen are — each with a small picture of that area. Its only button says **Play**, meant in both
senses.

That click is the gesture. It starts the band, the radio and the accompaniment at once, and brings the sound up from
silence over three and a half seconds. By default the field also thinks along, so a single finger on the right is
already music.

The moment a hand does something of its own, the automatic part steps back: playing a tone hushes the radio for two
bars, choosing a chord stops a running schema from choosing for the same while.

## Why

The first ten seconds decide whether someone plays at all. Hearing a band and seeing where the two hands belong beats
any explanation.

The welcome page appears every time, not once: the gesture is needed every time anyway, and a fade-in that only new
visitors get would startle everyone else.

## Rejected

_Starting the music without a click._ Browsers block it, and it would be rude even if they did not.

_Showing the page only on the first visit._ Then a returning visitor gets no gesture, no fade-in, and a silent field.

_A short tutorial._ Three lines and a button beat a sequence of screens; whoever wants more finds the help behind the
question mark.
