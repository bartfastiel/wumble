# TypeScript modules, tests, CI/CD, SonarCloud

Date: 2026-09-20 · Status: accepted

## Context

The code must stay maintainable by people without AI, and it serves as an example of code quality.

## Decision

TypeScript strict, Vite (hashing, minify, single file as second output), Vitest with coverage ≥ 90 % on non-UI code,
Playwright (Chromium, WebKit), ESLint with Sonar rules, Prettier, git hooks without an extra package, Dependabot. Pure
modules below, thin Web Components above, speaking file names instead of comments. CI: lint → typecheck → tests →
build → size budget → E2E → Sonar quality gate. Pull requests need green checks, a human approval and an up-to-date
`main`; every pull request gets a preview deployment.

## Consequences

Accessibility where it does not complicate the code. No runtime dependencies; dev dependencies pinned.

## Rejected

_Tests only on the tricky parts._ The musical rules are exactly the part where a silent regression is inaudible until
someone plays the wrong chord on stage.
