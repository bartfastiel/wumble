# Hosting: unlisted on the existing server, at no extra cost

Date: 2026-09-20 · Status: accepted

## Context

The app should be shareable but not discoverable; a server with Caddy and Docker already exists (wildcard DNS in place).

## Decision

Own subdomain as its own Caddy site block (`tls force_automate`, otherwise Caddy waits for a wildcard certificate that
never comes), files served read-only from the volume, secret path, `noindex`, own CSP, camera allowed. Deployment via SSH
from GitHub Actions; production, `next` and PR previews under separate path tokens.

## Consequences

No new DNS entry, no cost, seconds of downtime only on Caddy changes. The main site stays untouched.

## Rejected

_A separate host or a static hosting service._ Another bill, another set of credentials, another place to keep
current – for a page that is a few hundred kilobytes.

_A public link with an index entry._ The app is shown to people who get the link, not to a search engine.
