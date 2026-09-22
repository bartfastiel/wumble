# main only moves forward

Date: 2026-09-20 · Status: accepted

## Context

A pull request that is merely "in progress" must not take anything away from the people using the app or from the
next reader of the code.

## Decision

`main` never regresses. A pull request may only merge if it leaves `main` at least as good: green checks, coverage and
size budget not worse. Every pull request gets its own preview deployment, so a change can be tried before it lands.

## Consequences

Previews are reviewable as a whole product. Nothing half-finished is ever the live version.

## Rejected

_A long-lived development branch._ It postpones the merge pain instead of removing it, and the preview of a branch
nobody uses says nothing about the product.
