# A pitch class has no register

Date: 2026-09-22 · Status: accepted

## Context

With a transposing keyboard, changing from C to B made everything sound almost an octave
higher. The player objected: register is a property of the melody, not of the key.

## Decision

Every sounded note is a stack of octaves, weighted by a bell curve around a fixed centre. A
parameter blends between a fixed centre — where a pitch class has no register at all — and the
real pitch of the key that was touched.

## Why

The objection is correct, and it is the same insight that underlies the theory of pitch classes.
Keeping the centre fixed also has a practical effect: nothing in the field can ever sound shrill
or thin, however far out the player reaches, because the extremes are always filled in from the
middle.

## Rejected

_Transposing the whole keyboard with the key._ The straightforward implementation, and the
reason the problem existed.
