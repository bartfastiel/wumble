# Audience: relay without dependencies, prediction instead of waiting

Date: 2026-09-20 · Status: accepted

## Context

Listeners should see the lyrics scroll in sync on their phone; network latency 50–300 ms.

## Decision

WebSocket relay in Node without a library (rooms, roles, server time), as a container next to the existing website
behind Caddy `/ws`. Both sides know the song; the player sends sync points with server time, listeners align their clock
via ping median, estimate the tempo from the last onsets, run at most one syllable ahead and correct softly. QR code in
plain JS.

## Consequences

Visual error below 100 ms on average at 200 ms latency. The offline single-file build uses the online relay when its
address is configured.

## Rejected

_Waiting for the sync point and then jumping._ Honest, and it looks like a stutter on every phone in the room.
