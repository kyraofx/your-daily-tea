# Your Daily Tea

**A fully automated morning news briefing that turns yesterday's noise into one calm, frozen edition.**

[Read today's edition](https://www.yourdailytea.com) · [Meet the creator](https://gettoknowkyra.com)

## The story

I built Your Daily Tea around a simple question:

> Out of everything that happened yesterday, what is actually worth knowing this morning?

Most news products never stop updating. That makes them comprehensive, but also repetitive and exhausting. Your Daily Tea takes the opposite approach: one concise edition each morning, a clear cutoff, no filler, and a permanent archive of exactly what readers saw that day.

The first edition launched on August 18, 2026 with 41 stories across 14 active sections. The product now runs autonomously—from source discovery and editorial review through database publication—while preserving deterministic quality and safety rules around the AI.

## What readers can do

- Read one frozen daily briefing across 15 sections, beginning with USA, California, and World.
- Expand or collapse sections and follow every story to its original source.
- Browse previous editions by date.
- Follow structured topics across the archive.
- Search by phrase, date range, or category.
- Switch between dark and light reading themes.

## How it works

Every morning, the newsroom workflow:

1. Collects timestamped candidates from a reviewed RSS/Atom source registry.
2. Enforces the exact prior 24-hour Pacific coverage window.
3. Normalizes URLs and removes duplicate or previously covered stories.
4. Evaluates each of the 15 sections with `gpt-5.6-luna`.
5. Applies deterministic scoring, source-diversity, and section-balance rules.
6. Runs one grounded cross-section editorial review.
7. Fails closed if the edition is too thin or incomplete.
8. Saves, approves, publishes, and verifies an immutable Supabase edition.

The workflow starts at 6:07 AM in `America/Los_Angeles`, so daylight-saving changes are automatic. If generation fails—or produces fewer than 20 stories across 10 populated sections—the previous edition remains live.

## Engineering highlights

- **AI with guardrails:** the model can evaluate supplied candidates, but deterministic code controls timestamps, provenance, scoring, source caps, deduplication, and publication thresholds.
- **Immutable archive:** Supabase transition guards prevent published editions from being changed retrospectively.
- **Secure public data:** row-level security exposes published content while keeping drafts and newsroom credentials private.
- **Reliable automation:** GitHub Actions handles timezone-aware daily generation, encrypted credentials, concurrency, diagnostics, and manual recovery runs.
- **Independent reader runtime:** the website reads the newest published edition automatically; daily publication does not require a site redeployment.
- **Production domain and SSL:** the public experience is served at [yourdailytea.com](https://yourdailytea.com).

## Technology

| Layer | Choice |
|---|---|
| Frontend | React, Vinext, TypeScript, CSS |
| Hosting | OpenAI Sites on Cloudflare Workers |
| Database | Supabase PostgreSQL |
| Data access | Supabase REST API with RLS |
| Newsroom AI | OpenAI Responses API with `gpt-5.6-luna` |
| Automation | GitHub Actions |
| Testing | Node test runner, ESLint, production build checks |

## Run locally

Requires Node.js 22.13 or newer and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Verification:

```bash
pnpm test
pnpm test:newsroom
pnpm lint
```

Copy `.env.example` to `.env.local` for local configuration. Never commit local environment files or credentials.

## Explore the repository

- [`app/`](app/) — reader interface and public API routes
- [`scripts/newsroom/`](scripts/newsroom/) — discovery, evaluation, deduplication, review, and publication
- [`supabase/migrations/`](supabase/migrations/) — schema, RLS, views, and immutable publication rules
- [`.github/workflows/daily-edition.yml`](.github/workflows/daily-edition.yml) — production scheduler
- [`tests/`](tests/) — newsroom and rendered-experience verification
- [`docs/project/`](docs/project/) — product, requirements, architecture, decisions, and roadmap
- [`AGENTS.md`](AGENTS.md) — operational instructions for future coding agents

## Production notes

GitHub `main` is the source of truth. Website-code changes require a new OpenAI Sites deployment; new database editions appear automatically. Published editions must never be overwritten, RLS must remain enabled, and server credentials must never enter browser code or committed files.

Created by [Kyra](https://gettoknowkyra.com).
