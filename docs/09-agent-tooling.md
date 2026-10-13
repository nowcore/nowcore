# 09 — Agent tooling

What is set up for Claude Code in this repo, and what is only recommended. Audited honestly: a server
listed as "configured" here has an entry in a checked-in file; anything else is a recommendation.

## 1. MCP servers

| Server               | Status               | Where                                                                                        | Why                                                                                                                                                             |
| -------------------- | -------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **nx**               | Configured           | `.mcp.json`                                                                                  | Workspace graph, project details, generator schemas. Inert until T-012 creates the workspace.                                                                   |
| **claude-in-chrome** | Available (built-in) | —                                                                                            | Live visual QA; used for the reference-site analysis on 13 Oct 2026.                                                                                            |
| **Supabase**         | Recommended          | `claude mcp add supabase -- npx -y @supabase/mcp-server-supabase@latest --project-ref=<ref>` | Migrations, table inspection, type generation, branches. Add at T-017 once the project exists.                                                                  |
| **Chrome DevTools**  | Configured           | `.mcp.json` (`npx -y chrome-devtools-mcp@latest`)                                            | Performance traces and Core Web Vitals. The `motion-check` skill depends on it. Installed 13 Oct 2026; enabled in the gitignored `.claude/settings.local.json`. |
| **shadcn**           | Recommended          | `npx shadcn@latest mcp init --client claude`                                                 | Component install for the admin. Add at T-063.                                                                                                                  |
| **Playwright**       | Recommended          | `claude mcp add playwright -- npx -y @playwright/mcp@latest`                                 | E2E checkout and visual regression for `libs/motion`.                                                                                                           |
| **Context7**         | Recommended          | `claude mcp add context7 -- npx -y @upstash/context7-mcp`                                    | Current docs for GSAP, Lenis, Next 16 — they move faster than training data.                                                                                    |

**There is no MCP server for Printrove, Qikink or Razorpay.** Those are plain REST integrations in
`libs/pod` and `apps/api`.

Credentials for Supabase MCP go in user scope (`claude mcp add` without `--scope project`), never in the
checked-in `.mcp.json`.

## 2. Skills

| Skill          | When it runs                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `finish-task`  | A T-xxx task's code is written: verify, watch a guard fail, format, document, commit.                |
| `motion-check` | After building or changing any animated surface: trace, three tiers, reduced-motion, record numbers. |
| `new-drop`     | Shipping a drop, or changing any step of the drop pipeline.                                          |

## 3. What goes where

| Kind of thing                                       | Where it goes            |
| --------------------------------------------------- | ------------------------ |
| A rule that must hold on **every** edit             | `CLAUDE.md`              |
| A **procedure** run at a particular moment          | `.claude/skills/<name>/` |
| A fact about **why** the code is the way it is      | `docs/`, and a comment   |
| Something that must be **enforced**, not remembered | a test, or a lint rule   |

A skill's body loads only when used; `CLAUDE.md` is paid for on every message. That is why brand tokens
live in `CLAUDE.md` + a lint rule (every edit), while the drop pipeline is a skill (one moment).

## 4. Permissions

`.claude/settings.json` pre-approves read-only and nx-mediated commands. Deliberately **not** approved:
`git commit`, `git push`, and anything that changes state outside the working copy. `.env` files are
denied for reading outright; `.env.example` is the readable answer to "what does this need".
