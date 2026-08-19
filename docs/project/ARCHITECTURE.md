# Architecture

## System Overview

The product has two major parts:

1. A **newsroom engine** that gathers, evaluates, writes, and freezes one edition each morning.
2. A **website** that serves the saved edition and its archive without regenerating content per visitor.

High-level flow:

`Sources → category retrieval → validation and deduplication → scoring and editorial selection → Top Stories promotion → briefing generation and tagging → frozen edition storage → website`

## Frontend

Required capabilities:

- Render today's frozen edition in the agreed 13-section order.
- Render archived editions by date.
- Provide previous/next and calendar navigation.
- Link stories to their attributed sources.
- Make topics/hashtags interactive.
- Show topic-filtered archive results with date filters.

Framework and hosting choices are TBD. Next.js/React was discussed as an option, not locked as a decision.

## Backend

Required responsibilities:

- Trigger the pipeline daily at 6:00 AM Pacific.
- Run multiple targeted retrievals for each subject category.
- Normalize candidate metadata and enforce the publication cutoff.
- Deduplicate overlapping coverage and prefer original sources.
- Compare candidates with archived stories for material newness.
- Apply credibility checks and weighted editorial scoring.
- Perform a final selection and diversity pass without fixed filler quotas.
- Select 3–5 Top Stories from already-selected category stories.
- Generate concise summaries and structured topics.
- Save and publish an immutable daily edition.
- Query archived editions by date and stories by topic plus date constraints.

Implementation language, API shape, job orchestration, and operational tooling are TBD. Python and several scheduling services were discussed as options, not selected decisions.

## Database

PostgreSQL is the accepted database direction; see [DECISIONS.md](DECISIONS.md).

The logical model must support at least:

- **Editions:** edition date, coverage start/end, publication time, and frozen status.
- **Stories:** headline, summary, source metadata, original publication time, and canonical URL.
- **Categories:** the subject taxonomy and display order.
- **Edition story placements:** a story's section, rank, and Top Stories promotion without duplicating the underlying story.
- **Topics:** structured name, slug, and optional type, displayed as hashtags.
- **Story-topic relationships:** many-to-many links for archive filtering.
- **Source records or source metadata:** enough information for attribution and quality evaluation.

Exact schema, migrations, indexes, retention, and backup policies are TBD.

## External Services

The agreed direction is a hybrid retrieval strategy:

- RSS feeds.
- Official or publisher APIs where appropriate.
- Selected web search for coverage gaps and category-specific discovery.
- Primary sources such as government agencies, universities, research papers, and company announcements where appropriate.
- Social/trend signals for discovery only, followed by credible verification.
- An AI model/API for classification, scoring assistance, summarization, and topic extraction from retrieved source material.

Specific vendors, source contracts, API plans, and licensing arrangements are TBD. The system should publish original short summaries, attribution, and links rather than reproduce articles wholesale.

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
10. Choose 3–5 Top Stories from the selected category stories.
11. Write concise briefing copy and assign roughly 2–5 structured topics per story.
12. Freeze and persist the edition.
13. Serve the same saved edition to all readers and expose it through date/topic archive queries.

