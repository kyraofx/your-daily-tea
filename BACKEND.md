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

- `GET /api/editions/today`
- `GET /api/editions/YYYY-MM-DD`

The next backend increment adds topic/date queries, source ingestion, candidate scoring, and the private calibration report.
