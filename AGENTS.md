# Agent instructions — Your Daily Tea

These instructions apply to the entire repository. Read them before changing code, infrastructure, content rules, automation, or documentation.

## Start here

Read the following files before substantial work:

1. `README.md`
2. `docs/project/PRODUCT.md`
3. `docs/project/REQUIREMENTS.md`
4. `docs/project/ARCHITECTURE.md`
5. `docs/project/DECISIONS.md`
6. `docs/project/ROADMAP.md`
7. `BACKEND.md` for newsroom, Supabase, or automation work

Keep these documents current when implementation or operational behavior changes. Record material architectural or product decisions in `docs/project/DECISIONS.md`.

## Production system

- Public website: `https://www.yourdailytea.com`
- Root domain: `https://yourdailytea.com`
- Source of truth: GitHub `main`
- Web runtime: Vinext hosted by OpenAI Sites
- Database: Supabase PostgreSQL with RLS
- Daily automation: `.github/workflows/daily-edition.yml`
- Newsroom model: `gpt-5.6-luna`

Treat `main`, Supabase, Sites, both domains, and the GitHub Actions workflow as production.

## Product rules that must remain true

- Preserve the established supplied visual design unless Kyra explicitly approves a redesign.
- Keep exactly 15 sections in the confirmed order; `USA` is first.
- Do not add a `Top Stories` section.
- Do not add standard `Why it matters` blocks.
- Show quiet sections without inventing filler.
- Today, Archive, Topics, and Search must remain functional and responsive.
- Published editions are frozen and immutable.
- Public edition numbers count successful published editions only.
- Story attribution, canonical links, publication times, and topics must remain intact.
- Use Pacific time for the 6:00 AM coverage cutoff and daily edition date.

## Daily publication rules

The scheduled workflow starts at 6:07 AM in `America/Los_Angeles`. It gathers candidates, performs deterministic validation and deduplication, evaluates all sections, runs grounded final review, applies quality gates, and advances a qualifying edition through `draft -> approved -> published`.

- Never bypass the database transition guard.
- Never overwrite or edit a published edition.
- Never reduce or remove the fail-closed behavior without explicit approval.
- Current automatic minimums are 20 stories and 10 populated sections.
- A failed run must leave the previous published edition live.
- Preserve idempotence for duplicate dates and manual retries.
- New editions should appear without a website redeployment.

## Supabase and security

- Keep RLS enabled on every exposed table.
- Anonymous readers may access published content only.
- Never expose a Supabase secret/service-role key to browser code.
- Do not use user-editable metadata for authorization.
- Views exposed through the Data API must use `security_invoker` where supported.
- Review triggers, policies, grants, and publication immutability before schema changes.
- Add schema changes through Supabase migrations and verify them against the live project before declaring completion.

## Secrets

Never commit `.env`, `.env.local`, newsroom work files, API keys, tokens, credentials, or downloaded production data.

Production automation expects encrypted GitHub secrets named:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `OPENAI_API_KEY`

Do not print secret values in logs, test output, pull requests, or documentation.

## Implementation workflow

1. Start from the latest `main` and use a focused branch.
2. Inspect existing behavior before editing.
3. Preserve the current architecture and package manager.
4. Make the smallest complete change.
5. Update affected documentation.
6. Run the relevant verification.
7. Open a pull request and review it before merging.

Do not discard unrelated user changes. Do not run destructive Git, database, DNS, hosting, or filesystem operations without resolving the exact target and confirming they are within scope.

## Required verification

For reader or API changes:

```bash
pnpm build
```

For newsroom, persistence, scoring, source, or publication changes:

```bash
pnpm test:newsroom
pnpm build
```

Add or update tests for new behavior. A successful build alone is not proof that Supabase writes, GitHub schedules, DNS, or Sites deployment succeeded; verify the relevant external state directly.

## Deployment behavior

Pushing or merging website code to GitHub does not automatically redeploy OpenAI Sites. After a website change:

1. Build the exact source commit.
2. Push that exact source state to the configured Sites source repository.
3. Save a Sites version from the matching commit and build archive.
4. Deploy it with the existing access policy.
5. Wait for deployment success and verify `https://www.yourdailytea.com`.

Do not recreate the Sites project or replace `.openai/hosting.json`. Database-only daily editions do not require a Sites deployment.

## When information is missing

Prefer evidence from repository code, Supabase, GitHub, and Sites over assumptions. Ask Kyra before choices that alter editorial policy, public access, domains, costs, credentials, data retention, the visual design, or publication safeguards.
