# The address is no longer hidden

Date: 2026-09-23 · Status: accepted, supersedes part of 2026-09-20-hosting-unlisted-on-existing-server

## Context

The app went up behind a secret path, with a `robots.txt` that disallowed everything and a `noindex` header on top:
it was half-finished, and a half-finished instrument that anyone can find is a promise nobody made. Every link had
to carry the secret, which made it awkward to hand to someone – and the secret sat in a repository secret, a local
file and the deployment log, which is three places for something that was supposed to be known by one person.

## Decision

The app is served directly under its own host, with nothing in front of it. The `robots.txt` is gone, the `noindex`
header with it, and the deployment writes into a directory of its own next to the previews, which keep their path.

It is still not advertised: no links from anywhere, no announcement. Whoever finds it may look.

## Why

Hiding something behind a path is not privacy, it is inconvenience – for the people it was meant for. The thing that
actually keeps it quiet is that nobody points at it.

Taking the secret out also removes the one thing that could leak from a public repository in a way that mattered.

## Rejected

_Keeping `noindex` without the secret path._ Half a measure: it says the page should not be found while the page is
open to anyone who looks. Either it is ready to be seen or it is not.

_A password._ For an instrument you hand to a child at a family table, a password is one more thing to say out loud.
