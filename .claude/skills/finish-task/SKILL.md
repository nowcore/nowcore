---
name: finish-task
description: Finish a task from docs/06-task-breakdown.md — verify, sabotage-check, format, document, commit. Use when a T-0xx task's code is written and it needs its checks, docs and commit.
---

Run these in order. Do not skip 2.

## 1. Verify

```bash
pnpm exec nx run-many -t typecheck lint test build
```

Use `nx`, never the underlying tool — the cache and `dependsOn` graph are what stop a suite passing
against a stale build. Worker queue tests need `pnpm infra:up`.

## 2. Watch a guard fail

Break the thing each new test exists to catch. Confirm **exactly** that test fails, then restore and
re-run. A check that has never been seen failing is not evidence.

The failures this project expects to find this way: a `noEmit` in a tsconfig silently disabling the
`typecheck` target; a webhook handler whose idempotency key is computed but never read; a budget target
that passes because it measured a stale `.next` directory; a `@Processor` with no worker behind it.

## 3. If you touched an animated surface

Run the `motion-check` skill before going further. A cinematic surface that was never measured is a
claim, not a feature.

## 4. Format

```bash
pnpm exec prettier --write <touched files>
pnpm exec prettier --check .
```

CI runs `--check .` across the whole repo, so an unformatted file anywhere is a red build.

## 5. Sync project references

If a project's dependencies changed: `pnpm exec nx sync`, then `pnpm exec nx sync:check`.

## 6. Document

- `docs/06-task-breakdown.md` — prefix the task's description with `✅ `.
- `docs/08-progress.md` — bump the Status count and **Next up**, then add an entry at the **top**:
  what landed, each decision _with the alternative that was rejected and why_, `**Counts:**`,
  `**Watched failing before being trusted:**`, `**Carried forward:**`.
- `docs/07-setup.md` if a new command, env var or dependency is needed to run the thing.
- `docs/04-hld.md` if the directory tree changed; `docs/05-lld.md` if a schema or endpoint changed;
  `docs/03-tech-stack.md` if a sketch in it is now real code.
- `docs/flow.md` if the task adds or changes a flow — keep the file-by-file path true.
- `docs/decisions.md` if a decision was taken along the way: a row with what, **why**, and what was rejected.
  A doc that contradicts the code is worse than no doc.

## 7. Commit

Subject: `type(scope): short lowercase phrase` — what it does, not the task ID. Body: why it is
built this way, including what was rejected. End with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**Do not push unless asked.**
