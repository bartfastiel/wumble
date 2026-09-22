# English repository, i18n resources for user-facing text

Date: 2026-09-20 · Status: accepted

## Context

The repository is public and meant to be read and extended by anyone. Text shown to users (labels, help texts, song
titles, lyrics) is content, not code: it must be German for the songs this instrument grew up with, and translatable
into anything else.

## Decision

Everything in the repository is English: identifiers, comments, docs, ADRs, README, workflow and job names, commit
messages. User-facing text lives in i18n resources (`src/i18n/<locale>.ts`) behind a typed `t(key, params)`, never
inline in code; the locale follows `navigator.language` (German where available, English otherwise).

## Consequences

One language for readers and tooling; user text is translatable from the start. German text in code is a review
finding.

## Rejected

_German throughout._ Half the world can read the code; only a small part of it can read German.

_English user interface only._ The songs are German nursery rhymes – their syllables cannot be translated away.
