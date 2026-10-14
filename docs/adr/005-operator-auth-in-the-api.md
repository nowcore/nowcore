# ADR-005 — Operator sign-in lives in the API

**Status:** Accepted, 14 Oct 2026 · amends ADR-003 for operators only

**Context.** ADR-003 put authentication on Supabase Auth. The operator chose local Postgres only for now
(13 Oct); Supabase Auth needs the hosted project or its full local stack. The admin (Phase 4) cannot wait,
and it has exactly one kind of user: the people running the label.

**Decision.** Operators sign in against the API. `operators` holds a scrypt hash (`salt:hash`, N=2^15);
a session is 32 random bytes whose SHA-256 is stored in `operator_sessions` with a 12-hour expiry. The admin
app keeps the token in an httpOnly, `SameSite=Strict` cookie and sends it server-side as a bearer token;
`OperatorGuard` resolves it on every admin request. Five failed attempts per email lock that email for 15
minutes. Wrong email and wrong password return the same message and take the same time.

**Why.** No new dependency (scrypt is in Node). Authorization stays where ADR-003 wanted it — one testable
place in the API. Nothing about it depends on the hosted project.

**Consequences.** Two auth systems once buyer accounts arrive (Phase 6, Supabase phone OTP). That is
acceptable: operators and buyers never share a session, a table, or a threat model. The failed-attempt
counter is per process and in memory — a restart clears it, which only ever favours a legitimate operator;
multiple API instances each keep their own, so the effective limit is 5 × instances.

**Alternatives rejected.** Supabase Auth for operators now (blocks on the hosted project). A shared admin
password in an env var (no per-person audit trail — every order event records which operator acted).
Magic links (needs an email provider, which also does not exist yet).
