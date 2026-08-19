# Your Daily Tea backend

## Chosen architecture

- **Public site:** Sites-hosted Vinext application.
- **Database:** Supabase PostgreSQL.
- **Editorial pipeline:** a GitHub Actions newsroom worker starts daily at 6:07 AM Pacific, with guarded backup attempts at 6:22, 6:37, 6:52, and 7:07, using encrypted Supabase and OpenAI repository secrets.
- **Publication:** a passing run generates the reviewed edition, saves it as `draft`, records an automated approval, and publishes it. Runs below 20 stories or 10 populated sections fail closed and leave the prior edition live.
- **Public access:** anonymous visitors can read only `published` editions. Draft and approved editions are blocked by row-level security.

## Publication state machine

`draft -> approved -> published`

Failed runs use `failed` and never appear publicly. The scheduled publisher still passes through both guarded state transitions, but does so automatically only after the complete review and quality gates pass.

The production workflow records `github-actions-newsroom` in `approved_by` after all review and quality gates pass. Manual draft creation remains available for diagnosis, but it is not the daily production path.

Before installing dependencies or calling Luna, every scheduled attempt checks the public date endpoint. A `200` response means the edition is already published and the attempt exits successfully without generation cost. A `404` permits generation; any other response fails closed. The workflow's concurrency group also prevents overlapping newsroom jobs.

## Local configuration

Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key. Never place the service-role key or OpenAI key in browser code.

Apply `supabase/migrations/202608180001_initial_newsroom.sql` to a new Supabase project. It creates the confirmed 15-section taxonomy beginning with USA, California, and World. A database trigger rejects skipped approval states and makes published editions immutable.

## Public endpoints

- `GET /api/editions?limit=31&before=YYYY-MM-DD`
- `GET /api/editions/today`
- `GET /api/editions/YYYY-MM-DD`
- `GET /api/topics`
- `GET /api/topics/TOPIC-SLUG?range=all|today|7d|30d`
- `GET /api/topics/TOPIC-SLUG?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`

## Manual newsroom runner

`pnpm newsroom:dry-run` validates the example candidate file, enforces the exact Pacific coverage window, normalizes tracking URLs, rejects duplicate or low-scoring candidates, applies the agreed weighted score, limits each section to four stories, and prints a calibration report.

Use `node scripts/newsroom/run.mjs --input path/to/candidates.json --date YYYY-MM-DD` for another candidate set. The runner reads ordinary public configuration from `.env.local` and secrets from `$HOME/.config/your-daily-tea/secrets.env`. Add `--save` only after `SUPABASE_SECRET_KEY` has been configured securely; saving always creates a private draft.

## AI-assisted retrieval

`pnpm newsroom:feeds -- --category usa --date YYYY-MM-DD` performs deterministic, read-only discovery from the configured RSS/Atom registry. It normalizes headlines, canonical URLs, source names, summaries, and timestamps; filters the exact Pacific edition window; removes duplicate URLs; and writes a private candidate file under `work/`. Feed failures are isolated so one unavailable source does not discard the others.

`pnpm newsroom:audit-sources` verifies that every section has at least two configured sources. Add `-- --live` to fetch and parse all feeds; the command fails if a source is unavailable or returns no parseable items. The initial registry contains 36 feeds and provides 2–6 sources per section.

Every source has a deterministic tier: primary (98), major newsroom (92), or specialist publication (88). Feed metadata carries that score into evaluation, and the evaluator grounds Luna's output back to the exact supplied URL, headline, source, and timestamp before overriding the model's source-quality score. Final selection allows no more than two stories from one source in a section and six across a complete edition; it leaves a section short rather than adding source-heavy filler.

`pnpm newsroom:retrieve` uses the OpenAI Responses API with low-context web search and a strict candidate schema. It researches each of the 15 sections separately and writes the results to a private, git-ignored file under `work/`. The default model is the cost-sensitive `gpt-5.6-luna` with reasoning disabled; override the model with `OPENAI_NEWSROOM_MODEL` when needed.

During calibration, retrieve one section first:

`pnpm newsroom:retrieve -- --category usa --date YYYY-MM-DD`

Then inspect and score the candidate file without publishing:

`node scripts/newsroom/run.mjs --input work/candidates-YYYY-MM-DD.json --date YYYY-MM-DD`

Add `--save` to the runner only after reviewing its report. This manual command creates a private draft and does not publish it. A valid OpenAI key with active API billing/quota is required for retrieval.

`pnpm newsroom:evaluate -- --category usa --input work/feed-candidates-usa-YYYY-MM-DD.json` sends the feed metadata to Luna without web search, producing a private structured shortlist. The regular runner then applies cutoff, score, duplicate, and primary-topic diversity gates. During calibration, inspect that final report before any `--save` operation.

`pnpm newsroom:dedupe -- --input file-one.json,file-two.json` performs cross-source and cross-section event deduplication, preferring the higher-scoring or higher-quality candidate. It also reads the last 30 days from Supabase's published, security-invoker archive view and rejects materially repeated coverage. Use `--archive-days N`, `--output`, and `--report` to customize the read-only comparison.

`pnpm newsroom:generate-edition -- --date YYYY-MM-DD` runs the complete read-only calibration pipeline for all 15 sections and writes private checkpoints, candidates, deduplication results, initial selection, final editorial decisions, a review report, and a manifest under `work/edition-YYYY-MM-DD/`. The final grounded Luna pass makes only keep, remove, or move decisions for supplied story URLs, then deterministic balance rules run again. Add `--resume` after a transient failure to reuse completed category and final-review checkpoints without repeating Luna calls. This command never saves or publishes; use the separate runner with `--save` only after reviewing the generated report.

After reviewing the final report, save that exact result with:

`pnpm newsroom:save-reviewed -- --input work/edition-YYYY-MM-DD/final-review-report.json`

The reviewed-report writer accepts only reports carrying final editorial-review metadata, decodes residual HTML entities in display copy, refuses to overwrite an existing edition date, and always inserts `draft`. The manual command remains draft-only. The scheduled command applies the automatic quality gates before advancing the new edition through approval and publication.

The first verified database edition is `2026-08-18`: 41 reviewed placements across 14 non-empty sections. It was saved privately, confirmed invisible through the publishable key, explicitly approved by the owner, and then separately published. Post-publication verification through the publishable key returned exactly one edition and all 41 stories with matching section counts.
