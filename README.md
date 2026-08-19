# Your Daily Tea

Your Daily Tea is a concise daily news briefing covering 15 fixed sections, beginning with USA, California, and World. It publishes one frozen edition each morning, keeps a permanent archive, and supports topic and archive search.

## Production

- Website: [www.yourdailytea.com](https://www.yourdailytea.com)
- Root domain: [yourdailytea.com](https://yourdailytea.com)
- Creator: [Kyra](https://gettoknowkyra.com)
- Hosting: OpenAI Sites
- Database: Supabase PostgreSQL
- Automation: GitHub Actions

## Current behavior

- Displays the latest published edition in the supplied editorial design.
- Preserves the confirmed 15-section order and shows quiet sections without filler.
- Provides Today, Archive, Topics, and Search views.
- Publishes a new edition automatically each day after 6:07 AM Pacific.
- Uses `gpt-5.6-luna` for grounded candidate evaluation and final editorial review.
- Fails closed when an edition has fewer than 20 stories or fewer than 10 populated sections, leaving the previous edition live.
- Treats published editions as immutable and numbers only successful publications.

## Architecture

The Vinext application reads only published content through Supabase's row-level-security-protected Data API. Server-only newsroom credentials are used exclusively by the scheduled GitHub Actions workflow.

The daily pipeline:

1. Collects timestamped stories from the reviewed RSS/Atom source registry.
2. Filters the exact prior 24-hour Pacific coverage window.
3. Deduplicates candidates against the current pool and published archive.
4. Evaluates each of the 15 sections with Luna.
5. Applies deterministic scoring, source-diversity, and section-balance rules.
6. Runs one grounded cross-section editorial review.
7. Applies automatic quality gates.
8. Saves, approves, publishes, and verifies the frozen Supabase edition.

## Local development

Requirements: Node.js 22.13 or newer and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm test:newsroom
```

Copy `.env.example` to `.env.local` for browser-safe local configuration. Never commit `.env.local` or secret keys.

## Publishing and deployment

The newsroom workflow runs from `.github/workflows/daily-edition.yml` on the `main` branch. It can also be started manually from GitHub Actions with an optional Pacific edition date.

Merging website code into GitHub does not by itself redeploy OpenAI Sites. After website changes, build and publish a new Sites version. New Supabase editions do not require a site deployment; the reader automatically loads the latest published edition.

## Project documentation

Future developers and coding agents should read these before making substantial changes:

- [`AGENTS.md`](AGENTS.md) — repository-wide instructions for coding agents
- [`docs/project/AGENTS.md`](docs/project/AGENTS.md) — working rules and project context
- [`docs/project/PRODUCT.md`](docs/project/PRODUCT.md) — product vision and scope
- [`docs/project/REQUIREMENTS.md`](docs/project/REQUIREMENTS.md) — functional and editorial requirements
- [`docs/project/ARCHITECTURE.md`](docs/project/ARCHITECTURE.md) — system design and data flow
- [`docs/project/DECISIONS.md`](docs/project/DECISIONS.md) — accepted architectural and product decisions
- [`docs/project/ROADMAP.md`](docs/project/ROADMAP.md) — completed and future phases
- [`BACKEND.md`](BACKEND.md) — newsroom commands, persistence, and operational details

## Safe contribution workflow

1. Create a branch from `main`.
2. Make a focused change.
3. Run the relevant build and tests.
4. Open a pull request.
5. Review before merging into production.

Do not weaken Supabase RLS, bypass the guarded publication state machine, overwrite a published edition, expose credentials, or replace the established visual design without explicit owner approval.
