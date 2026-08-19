# Architecture

## System Overview

The product has two major parts:

1. A **newsroom engine** that gathers, evaluates, writes, and freezes one edition each morning.
2. A **website** that serves the saved edition and its archive without regenerating content per visitor.

High-level flow:

`Sources → category retrieval → validation and deduplication → scoring and editorial selection → briefing generation and tagging → frozen edition storage → website`

## Frontend

Required capabilities:

- Render today's frozen edition in the agreed 15-section order.
- Render archived editions by date.
- Provide previous/next and calendar navigation.
- Link stories to their attributed sources.
- Make topics/hashtags interactive.
- Show topic-filtered archive results with date filters.

The implementation uses the Sites Vinext/React runtime and preserves the supplied HTML design. Public data is read from Supabase through server-side API routes; browser code never receives administrative credentials.

## Backend

Required responsibilities:

- Trigger the pipeline daily at 6:00 AM Pacific.
- Run multiple targeted retrievals for each subject category.
- Normalize candidate metadata and enforce the publication cutoff.
- Deduplicate overlapping coverage and prefer original sources.
- Compare candidates with archived stories for material newness.
- Apply credibility checks and weighted editorial scoring.
- Perform a final selection and diversity pass without fixed filler quotas.
- Generate concise summaries and structured topics.
- Save and publish an immutable daily edition.
- Query archived editions by date and stories by topic plus date constraints.

The website API is implemented in TypeScript. The newsroom engine will run as a separate scheduled worker so long-running retrieval and editorial work cannot delay reader requests. The worker runtime and scheduler remain to be finalized during calibration.

The current calibration runner accepts normalized candidate JSON, enforces the Pacific edition window, applies hard validation and the agreed weighted score, and optionally saves a private draft through a server-only Supabase credential. Deterministic RSS/Atom discovery now supplies timestamped candidates from a configurable source registry. A category-specific OpenAI Responses API adapter can supplement discovery with web search and strict structured output. Both remain manually invoked calibration tools; scheduling and automatic publication are disabled.

## Database

Supabase PostgreSQL is the accepted database and managed platform direction; see [DECISIONS.md](DECISIONS.md).

The logical model must support at least:

- **Editions:** edition date, coverage start/end, publication time, and frozen status.
- **Stories:** headline, summary, source metadata, original publication time, and canonical URL.
- **Categories:** the subject taxonomy and display order.
- **Edition story placements:** a story's section and rank within a frozen edition.
- **Topics:** structured name, slug, and optional type, displayed as hashtags.
- **Story-topic relationships:** many-to-many links for archive filtering.
- **Source records or source metadata:** enough information for attribution and quality evaluation.

Exact schema, migrations, indexes, retention, and backup policies are TBD.

## External Services

The agreed direction is a hybrid retrieval strategy:

- RSS feeds.
- Official or publisher APIs where appropriate.
- OpenAI Responses API web search for category-specific discovery, with a strict normalized candidate schema.
- Primary sources such as government agencies, universities, research papers, and company announcements where appropriate.
- Social/trend signals for discovery only, followed by credible verification.
- An AI model/API for classification, scoring assistance, summarization, and topic extraction from retrieved source material.

The OpenAI model is configurable and defaults to the cost-sensitive `gpt-5.6-luna` with reasoning disabled during retrieval calibration. Source contracts, other API plans, and licensing arrangements are TBD. The system should publish original short summaries, attribution, and links rather than reproduce articles wholesale.

## Data Flow

1. At the daily run, establish the exact Pacific coverage window.
2. Retrieve candidates separately for every subject category.
3. Normalize sources, URLs, timestamps, and article metadata.
4. Reject out-of-window candidates.
5. Merge duplicate reports and prefer original reporting.
6. Validate credibility and compare with the archive for material newness.
7. Score each candidate:
   - Importance: 25%
   - Interestingness: 20%
   - Audience relevance: 20%
   - Newness: 15%
   - Source quality: 15%
   - Momentum: 5%
8. Make a category-level editorial selection, allowing 0–4 stories for most sections.
9. Perform a cross-edition diversity check and prevent topic domination.
10. Write concise briefing copy and assign roughly 2–5 structured topics per story.
11. Freeze and persist the edition.
12. Serve the same saved edition to all readers and expose it through date/topic archive queries.
