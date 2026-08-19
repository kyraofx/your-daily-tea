# Your Daily Tea backend

## Chosen architecture

- **Public site:** Sites-hosted Vinext application.
- **Database:** Supabase PostgreSQL.
- **Editorial pipeline:** a separate scheduled newsroom worker using the Supabase service role and OpenAI API.
- **Publication:** every run creates a `draft`; the owner reviews it in the private Supabase dashboard, approves it, and only then publishes it.
- **Public access:** anonymous visitors can read only `published` editions. Draft and approved editions are blocked by row-level security.

## Publication state machine

`draft -> approved -> published`

Failed runs use `failed` and never appear publicly. Publishing is an explicit second action so approval cannot accidentally expose a partially generated edition.

During calibration, the owner records a short reviewer label in `approved_by` (for example, `owner`) and the approval timestamp in the private Supabase dashboard. This avoids requiring reader or editor accounts in the MVP.

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

Add `--save` to the runner only after reviewing its report. Saving creates a private draft and never skips the owner approval step. A valid OpenAI key with active API billing/quota is required for retrieval.

`pnpm newsroom:evaluate -- --category usa --input work/feed-candidates-usa-YYYY-MM-DD.json` sends the feed metadata to Luna without web search, producing a private structured shortlist. The regular runner then applies cutoff, score, duplicate, and primary-topic diversity gates. During calibration, inspect that final report before any `--save` operation.

`pnpm newsroom:dedupe -- --input file-one.json,file-two.json` performs cross-source and cross-section event deduplication, preferring the higher-scoring or higher-quality candidate. It also reads the last 30 days from Supabase's published, security-invoker archive view and rejects materially repeated coverage. Use `--archive-days N`, `--output`, and `--report` to customize the read-only comparison.
