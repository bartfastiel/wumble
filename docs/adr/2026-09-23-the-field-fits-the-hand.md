# The field fits the hand, not the screen

Date: 2026-09-23 · Status: accepted

## Context

The fan (see [the fan](2026-09-22-the-fan.md)) spreads eight octaves across the width and lets the focus decide which
of them are wide. That was designed on a screen almost a thousand pixels wide. On a phone held upright the field gets
about 250 of them, and two things break at once: the widest stripe shrinks to the size of a pencil line, and the tilt
— which is an angle, so it grows with height — carries a stripe two neighbours sideways between its ends. Both are
about the same mistake: geometry fixed in absolute terms on a surface whose size is not.

## Decision

Two rules, both read off the space that is actually there.

_As many tones lie wide as the width can afford._ The reach of the focus curve is no longer a constant but the width
divided by a playable size, capped at what it used to be and never so tight that one tone is left alone. A wide screen
shows the same broad fan as before; a narrow one concentrates on fewer tones and makes those big enough to hit.

_A stripe never drifts sideways further than it is wide._ The tilt of every edge is capped by the room beside it, so
narrow stripes stand upright and wide ones keep the full fan. The angle is the same wish everywhere; what differs is
how much of it the space grants.

The chord map gives way too: on a narrow screen it never takes more than a third of the width, however much its names
would like.

## Why

An instrument is played with a finger, and a finger is the same size on every device. Everything that has to be hit
must therefore be measured against the hand, not against a fraction of the screen. Fewer tones wide is the honest
trade: the range is still whole, still reachable by dragging, just less of it is in focus at once.

Capping the tilt by the room beside it says the same thing in the other direction. The fan exists so the eye can
follow the field; when it moves a stripe further than the stripe is wide, it stops helping the eye and starts hiding
the target.

## Rejected

_Asking for landscape._ Most of the reasons to pick up the instrument at all happen with a phone held upright.

_Showing fewer octaves on a small screen._ Tones would vanish mid-glissando, and the range strip would jump instead of
slide — the same objection that [the range](2026-09-23-the-range-is-dragged-not-scrolled.md) already answers.

_Stacking the map above the field when the screen is upright._ The map's vertical axis _is_ the pull; laid flat it
would have to mean something else, and the two hands would no longer be left and right.
