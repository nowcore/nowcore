# ADR-006 — Frames are served from an asset origin, never from the web build

**Status:** Accepted, 14 Oct 2026

**Context.** Rendered turntables were written into `apps/web/public/frames`. Next.js serves only files that
existed in `public/` at build time. Found in the browser on 14 Oct: a drop rendered after the web app was
built returned 404 for every frame until the next deploy. That defeats the one-day drop — rendering would
require deploying.

**Decision.** Frames live in storage (`.storage/frames` locally; Supabase Storage in production, T-035) and
are served from an asset origin. Locally the API serves them at `/frames/*` — path-confined, `immutable`
caching (every render writes a new revision path, so a URL never changes content), CORS and
`Timing-Allow-Origin` open because they are public. The database stores paths (`/frames/…`); the API
returns absolute URLs built from `ASSET_BASE_URL`, which becomes the CDN in production.

The storefront is told when the catalogue changes: the API calls `apps/web`'s `/api/revalidate` webhook
(shared secret) when a drop opens, closes or is extended. Best effort; the 30 s data cache is the fallback.

**Why.** Rendering and deploying are separate events and must stay that way.

**Consequences.** Frames are cross-origin to the storefront. `CanvasSequence` fetches them with CORS; Resource
Timing needs `Timing-Allow-Origin` or every frame reads as 0 bytes (`motion-check` went blind until it was
added). Serving files from the API is a local stand-in — in production that traffic belongs on a CDN, not the
API process.

**Alternatives rejected.** A Next route handler streaming frames from disk (puts file serving in a
BFF-only app, and couples the storefront to the storage layout). Redeploying the web app after each render
(turns a 10-second render into a deploy). Revalidating via a shorter cache (still stale, and more load).
