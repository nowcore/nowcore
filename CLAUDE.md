# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

**Before writing anything, answer two questions out loud:**

1. **Can this be less code?** Say what the shorter version would be. If it is genuinely worse, say why in one line and write the longer one. Otherwise write the shorter one.
2. **Does something already do this?** A library, a built-in, an existing helper in this repo, or a config change instead of code. Check before hand-rolling — but a dependency has to earn its entry in `package.json`: maintained, smaller than what it replaces, and not a framework where a function would do.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# NOWCORE

A trend-driven merch label. A trend is spotted, drawn, dropped, printed and shipped inside a day.
India first — Printrove for print-on-demand, Razorpay for UPI/cards/COD. Zero inventory.

Read [`docs/08-progress.md`](./docs/08-progress.md) first when picking up work. It says what is real.
[`docs/decisions.md`](./docs/decisions.md) says why things are the way they are; [`docs/flow.md`](./docs/flow.md)
says how a request moves through the files.

## The four things that must not drift

1. **The brand is a system, not a vibe.** Tokens live in `libs/ui` and [`docs/10-design-system.md`](./docs/10-design-system.md).
   Never write a raw colour or easing curve in an app — `nowcore/no-raw-design-values` fails lint outside `libs/ui`.
   The accent is `--drop-accent`, set per drop, never hardcoded.
2. **Motion lives in `libs/motion` and is budgeted.** Cinematic everywhere is only honest if it is
   engineered: every animated surface ships all three quality tiers (full / reduced / static) and passes
   the budgets in [`docs/10-design-system.md`](./docs/10-design-system.md). A surface that cannot hold
   55fps p95 on a mid-tier Android is not done.
3. **Fulfilment is behind a port.** Nothing outside `libs/pod` may import a Printrove type or call its
   API. India first does not mean India only; `PodProvider` is how Printful arrives later.
4. **Money is append-only and idempotent.** Order items snapshot price and title at purchase — POD
   catalogue prices move under you. Every Razorpay and Printrove webhook is idempotent on the provider's
   event id, because both providers retry and both will double-fire.

## Conventions

- **ESM only.** No CommonJS anywhere.
- **Zod at every boundary** — HTTP, webhook, queue payload, env.
- **NestJS is the only process that writes to the database**, via the Supabase service role. Authorization
  lives in the API where it can be tested. RLS is reserved for the few tables a client reads directly.
- **Nest:** one module per bounded context. Services hold domain logic and never import HTTP types.
- **Next:** server components by default; `'use client'` only where interactivity genuinely needs it.
  Every motion primitive is a client island, and the page must be readable and shoppable without it.
- **`apps/web/app/api/` is BFF only** — auth callbacks and webhooks. Never domain logic.
- Money is integer **paise**, never floats. Currency is explicit on every amount.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Branches: `type/scope-short-description`.

## Commands

Run everything through `nx`, never the underlying tool — the cache and `dependsOn` graph are what stop a
suite passing against a stale build.

```
pnpm infra:up              # Postgres :5433 + Redis :6381
pnpm db:migrate && pnpm db:seed
pnpm check                 # typecheck lint test build, every project
pnpm exec nx run web:budget  # 180 KB initial-route budget — fails on regression
pnpm dev                   # web :3000 · admin :3001 · api :4100 · worker
```

API and worker tests use the real Postgres and Redis — run `pnpm infra:up` first.
