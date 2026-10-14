# 12 — Runbook

What to do when something goes wrong during a drop. Each entry: **how you notice**, **what the system already
does on its own**, **what you do**. Written against the code as of 15 Oct 2026 — if a step here disagrees with
the code, the code wins and this page is wrong; fix it.

Commands assume the repo root. Production equivalents (hosted Supabase, Railway/Fly) arrive with T-099; until
then, "the database" is `docker exec nowcore-postgres-1 psql -U nowcore`.

---

## 1. A provider is down

### Razorpay (payments)

- **You notice:** buyers see "Payments are unavailable right now. Your cart is saved — try again shortly."
  (HTTP 502 from `POST /orders`).
- **The system already:** keeps the cart; the order it created stays `PENDING` with no provider order, so it
  can never be charged and reconciliation skips it. It holds its pieces for 15 minutes (ADR-008), then lets
  them go.
- **You:** check Razorpay's status page. Nothing to replay — buyers retry. If it lasts, consider extending the
  drop (admin → drop → Extend, 1–72 h) so the outage does not eat the window.

### Payments taken but webhooks not arriving

- **You notice:** orders sit `PENDING` though buyers say they paid.
- **The system already:** reconciles every 5 minutes — asks Razorpay about every order pending for 2 minutes
  to a day and marks the paid ones `PAID` (`RECONCILE=on`, the default). A payment that lands after its 15-minute
  hold, when the edition has since sold out, is still honoured and flagged (see §4).
- **You:** wait one cycle. If still stuck, confirm `RECONCILE` is `on` in the API's environment and the API logs
  show no errors from the provider.

### The printer (Printrove)

- **You notice:** orders stay `FULFILMENT_QUEUED`; later they turn up under **Orders → Attention**
  (`FULFILMENT_FAILED`) and the sidebar shows a red count.
- **The system already:** retries each submission 10 times with exponential backoff (~17 h) before marking it
  failed. Submissions are idempotent on our order reference, so a retry never prints twice.
- **You:** once the printer is back, open each attention order and press **Retry** — it re-queues the job. If the
  failure is permanent (a variant the printer does not stock, a refused address), fix the mapping or contact the
  buyer; **Cancel** or **Refund** as appropriate.

### Email (Resend)

- **You notice:** buyers report no confirmation; the worker log shows `notify` failures.
- **The system already:** retries each email 5 times. Orders are unaffected — email is told, never asked.
- **You:** check the key and sending domain. Every buyer can still see their order from the signed link
  on the order page.

### Redis down

- **The system already:** rate limits **fail open** (requests go through unlimited). Queues stop: nothing is
  submitted to the printer and no email is sent. A payment that lands while Redis is down still moves the order
  to `PAID`, but its printer job is never queued — and nothing retries that enqueue.
- **You:** restore Redis first. Then look for `PAID` orders that never moved on:

  ```sql
  select reference, created_at from orders where status = 'PAID' and created_at < now() - interval '10 minutes';
  ```

  There is no admin button for these yet — `PAID` is not an attention state, and Retry only accepts
  `FULFILMENT_FAILED`. Hand the list to the developer. **A known gap, carried forward in docs/08.**

---

## 2. An order is stuck

| Status for too long   | Usually means                                   | Do                                               |
| --------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `PENDING` > 15 min    | the buyer abandoned checkout                    | nothing; it holds no pieces after 15 min         |
| `PENDING`, buyer paid | webhook lost                                    | wait for reconciliation (5 min), see §1          |
| `PAID` > 10 min       | the printer job was never enqueued (Redis blip) | see §1, Redis                                    |
| `FULFILMENT_QUEUED`   | the printer is slow or down; retries running    | wait; it becomes `FULFILMENT_FAILED` after ~17 h |
| `FULFILMENT_FAILED`   | the printer refused or retries ran out          | **Retry**, or fix the cause, or Cancel/Refund    |
| `PRINTING` for days   | the printer's status webhook is not reaching us | check the printer dashboard; ask the developer   |
| `SHIPPED`, no updates | courier tracking stalled                        | follow the tracking link; RTO arrives by webhook |

**Refund is recorded, not issued.** Pressing Refund marks the order `REFUNDED` with your note; you must also
refund it in the Razorpay dashboard. (Issuing refunds through the API is not built.)

Every status change is in the order's history (admin → order), with who or what made it. Start there.

---

## 3. A drop did not open (or did not close)

The drop clock runs inside the API every minute (ADR-007).

- **A scheduled drop is past its time and still `SCHEDULED`:**
  1. Open it in the admin. If the **Publish check** lists problems, the clock is holding it — fix them (map the
     variants, wait for the turntable, fix the accent) and it opens within a minute. The API log says
     `drop N is due but cannot open: …`.
  2. If the check is clean, another drop is still live. One drop at a time is the rule; close the live one, or
     wait for it to close. The scheduled drop opens within a minute of that.
  3. If neither: confirm `DROP_CLOCK=on` in the API's environment, and that the API is running.
  4. To open it by hand, press **Open now** — the same check and the same lock as the clock.
- **A drop is past its close and still shows as live:** the clock closes it within a minute. Until then nobody
  can buy from it — cart and checkout refuse a drop past its `closesAt` regardless of status (T-084).
- **The storefront shows the old drop:** the API tells the storefront when a drop opens or closes, but the first
  request after may still be served from cache. Reload. If it persists, the revalidate webhook is failing —
  check `WEB_REVALIDATE_URL` and that `REVALIDATE_SECRET` matches between API and web. The storefront's own cache
  expires in 30 s regardless.
- **Waitlist alerts did not go out:** each opening queues one alert run per drop (`drop-open-<id>`), retried 3
  times; a subscriber is mailed at most once per drop, ever (the `drop_alerts` ledger), so re-running is safe.

---

## 4. The edition went over its cap

- **How:** only when a buyer paid more than 15 minutes after starting checkout and the edition sold out in
  between (ADR-008). The money is real and the garment is printed on demand, so the order is honoured.
- **You notice:** a warning in the API log, `paid after its hold lapsed; the edition is now over its cap`.
- **Find them:**

  ```sql
  select o.reference, o.email, e.created_at
  from order_events e join orders o on o.id = e.order_id
  where e.to = 'PAID' and e.payload ->> 'overEdition' = 'true';
  ```

- **You:** decide per order — print it (the default; it already went to the printer) or cancel and refund with
  an apology. The storefront counter shows paid pieces, so it may read above the edition size.

---

## 5. Under load

- `pnpm exec nx run api:load` (`BUYERS`, `EDITION`) reproduces a drop opening against a local API. Measured
  15 Oct: 1 000 buyers at once, order p95 2.1 s, zero 5xx, the edition exact.
- Buyers seeing **"Too many requests"** are being rate-limited per IP (`apps/api/src/limits.ts`). If every buyer
  sees it, the API is seeing one IP for all of them: check `TRUST_PROXY` (proxy hops in front of the API) and that
  web and the API share the same `BFF_SECRET`.
- A slow checkout during a rush is the per-drop lock serving buyers in turn — expected. A slow everything is the
  database pool; scale API instances and the pool (T-017).

---

## 6. Local development

- **`pnpm dev` stopped but something still answers on :4100 / jobs still run with old code:** stopping the dev
  command can leave nx's children running. List them and stop only NOWCORE's:

  ```bash
  ps -eo pid,command | grep -E "dist/main|next dev"
  lsof -a -p <pid> -d cwd   # confirm it is under workspaces/nowcore before killing it
  ```

  Found 14 Oct: three orphaned workers on old code took jobs meant for the new one.

- **The storefront shows nothing after a reseed:** `pnpm db:seed`, then reload — or POST the revalidate webhook.
