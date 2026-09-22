# No framework: one canvas for the field, Web Components for views

Date: 2026-09-20 · Status: accepted

## Context

The playing field – dozens of stripes that change width, a chord map that breathes, learn dots, ghosts, multi-touch –
must draw at 60 fps. Panels next to it are simple lists and forms.

## Decision

The playing field is a single canvas with one draw call per frame, and only when something changed. Views are custom
elements (`wm-*`) without a library, state in a small store. Zero runtime dependencies.

## Consequences

No framework migrations, no third-party security updates; templates and bindings are hand-written – hence thin
components and logic in pure modules.

## Rejected

_SVG or DOM elements per stripe._ Readable markup, but layout thrashing on every frame once the widths move.

_A rendering framework._ It would double the bundle for a screen that consists of one canvas.
