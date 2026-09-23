# The range is dragged, not scrolled

Date: 2026-09-23 · Status: accepted

## Context

Eight octaves never fit a screen at a playable width. The fan (see [the fan](2026-09-22-the-fan.md)) keeps them all
visible but leaves the outer ones too thin to hit. Something has to decide which octave is currently the wide one.

## Decision

A strip along the bottom of the field. Grab it anywhere — there is no handle to find — and the octaves slide past
under the finger: the field follows the hand exactly, like a sheet being pushed. Let go and it glides into the nearest
octave, so the tonic is always in the middle of the view.

Nothing is cut off while this happens. The stripes that leave the middle grow narrow and short, the ones arriving grow
wide and long; every tone stays reachable throughout.

## Why

An instrument is held, not operated. A scrollbar asks for a small target and gives a position; a grab area asks for
nothing and gives the octave a place. Snapping keeps the field predictable: after every slide the same tone sits in
the same place.

## Rejected

_A scrollbar with a thumb._ A target to aim at, in an app whose whole point is that you can put your finger anywhere.

_Buttons for octave up and down._ Two more things on screen, and every change a jump instead of a movement.

_Showing only the octaves in reach._ Tones would vanish mid-glissando, and a hand that overshoots would find nothing
there.
