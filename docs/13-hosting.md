# 13 — Hosting options (T-099, decision pending)

Researched 15 Oct 2026. Prices are list prices from public pages and third-party summaries that did not
always agree — **confirm on each provider's pricing page before paying**. Nothing here is decided until the
operator picks; the choice then goes into [`decisions.md`](./decisions.md).

## What has to run

| Process       | What it is                                          | Rough size                            |
| ------------- | --------------------------------------------------- | ------------------------------------- |
| `apps/web`    | Next.js storefront (server-rendered)                | 0.5–1 GB RAM                          |
| `apps/admin`  | Next.js admin                                       | 0.5 GB RAM, light traffic             |
| `apps/api`    | NestJS API — every page and every order hits it     | 0.5–1 GB RAM                          |
| `apps/worker` | BullMQ: printer jobs, emails, **turntable renders** | ~1 GB RAM; CPU bursts while rendering |
| Redis         | the queues                                          | small, but always on (see below)      |
| _Supabase_    | database + images — already hosted (Mumbai)         | —                                     |

## The constraint that decides it: the database is in Mumbai

The API makes several database round-trips per request. Singapore → Mumbai is roughly 60 ms each way, so an
API hosted in Singapore makes every page and every checkout visibly slower. **The API and the worker belong in
India.** That rules out most "easy" platforms:

- **Render** — no India region.
- **Railway** — no India region found in its published regions (Singapore is the nearest).
- **Fly.io** — has a Mumbai region (`bom`), but deployments there are reported as restricted and Fly points
  people to Singapore.

What does offer India: **DigitalOcean (Bangalore, BLR1)**, **AWS (Mumbai, ap-south-1 — EC2 or Lightsail)**,
and **Vercel Pro's Mumbai region (bom1)** for the two Next.js apps only.

**Redis:** BullMQ polls Redis constantly, so per-command serverless pricing (Upstash pay-as-you-go, $0.20 per
100k commands) grows with idle time, not traffic. A Redis process next to the worker, or a fixed-price plan,
fits better.

## Options

|                     | **A. One server in India** (recommended to start)                                                                    | **B. Vercel Pro + a server in India**                                               | **C. Railway (Singapore)**                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Where               | One DigitalOcean droplet in Bangalore, or AWS Lightsail in Mumbai, running all four apps + Redis with Docker Compose | Storefront + admin on Vercel (Mumbai); API + worker + Redis on one droplet in India | Everything on Railway, Singapore                                     |
| Latency to Supabase | ✅ same region                                                                                                       | ✅ API in India                                                                     | ❌ ~60 ms per query                                                  |
| Monthly cost (est.) | ~$24–48 for a 4 GB / 2 vCPU server; Cloudflare free in front                                                         | Vercel Pro ~$20 per committer + usage, **plus** ~$12–24 server                      | Pro $20 + usage (~$20/vCPU-month, ~$10–14 per GB RAM-month) ≈ $40–70 |
| Collaborators       | Free — anyone with repo access                                                                                       | Each committer needs a Vercel seat                                                  | Per plan                                                             |
| Commercial use      | ✅                                                                                                                   | ✅ on Pro                                                                           | ✅                                                                   |
| Deploys             | GitHub Actions on push to `main` (build images, SSH, `docker compose up`)                                            | Vercel deploys `main` itself; Actions for the server                                | Railway deploys `main` itself                                        |
| You look after      | OS updates, TLS (Caddy does it), restarts, disk                                                                      | The server half of A                                                                | Nothing — managed                                                    |
| Grows by            | A second server for the worker when renders compete with shoppers                                                    | Same                                                                                | Bigger plan                                                          |

## Recommendation

**A** to launch: everything in India next to the database, one bill, no per-seat fees, no commercial-use
restrictions, and the cheapest. The apps are already containerised in development (Docker for Postgres and
Redis), the database and images live in Supabase so the server holds no data that cannot be rebuilt (Redis
gets an append-only file so queued jobs survive a restart), and Cloudflare's free plan in front gives caching,
TLS at the edge and DDoS protection — and lets us add the `Timing-Allow-Origin` header `motion-check` needs.

Move the storefront to **B** later if global edge speed starts to matter more than one bill. **C** only if
Railway opens an India region.

## What the operator needs to provide for A

1. A DigitalOcean (or AWS) account with billing, and the region chosen: Bangalore or Mumbai.
2. A domain (and access to its DNS), to point at Cloudflare.
3. Cloudflare account (free).
4. Then: Razorpay live keys, Printrove credentials, Resend key + domain — the launch blockers already listed
   in [08-progress](./08-progress.md).

Sources checked: Railway, Fly.io, Render, Upstash, Vercel (bom1 regional pricing), DigitalOcean pricing pages
and 2026 comparisons — see the T-099 entry in 08-progress.
