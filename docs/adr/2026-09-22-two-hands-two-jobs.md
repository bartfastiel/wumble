# Two hands, two jobs

## Context

A player needs both a melody and something underneath it. One hand can do both only by
switching back and forth, which means the accompaniment stops whenever the melody moves.

## Decision

The screen is split. The left area chooses harmony, the right area plays melody. Both accept
several fingers at once, and both can be used simultaneously.

A melody key never triggers harmony. It sounds its own note and nothing else.

## Why

Separating the two means the accompaniment can keep sounding while the melody moves freely,
and a beginner can start with one hand and add the other later. It also keeps the mental model
honest: harmony is a state you are in, melody is what you do inside it.

## Rejected

_One-handed operation._ Tried first and dropped on the player's request — a tablet is held with
two hands anyway, so insisting on one finger buys nothing and costs the independence of the
two layers.
