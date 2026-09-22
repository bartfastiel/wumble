# Songs: public domain only, verified against sheet music

Date: 2026-09-20 · Status: accepted

## Context

Songs should make styles tangible; melodies from memory are error-prone, protected music is off-limits.

## Decision

Traditionals and composers before 1925 only. Every melody checked against a score (Wikipedia/Wikisource), every note
checked programmatically against scale and range; lyrics syllable by syllable per note, a mismatch is a load error.
Doubtful songs are dropped.

## Consequences

Fewer, but correct songs. Data checks are unit tests.
