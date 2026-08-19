# Roadmap

The sequence below reflects the product concepts discussed so far. Dates and implementation estimates are TBD.

## Phase 1 — Foundation

- Finalize the 15-section taxonomy and display order.
- Define the exact 6:00 AM Pacific edition boundary and immutable archive behavior.
- Define the initial source strategy and fetching method per category.
- Design the core PostgreSQL data model for editions, stories, placements, categories, sources, and topics.
- Resolve publisher usage, attribution, and licensing constraints.

Implementation status: the Supabase project, core schema, row-level security, immutable publication guard, 15-section taxonomy, and initial edition API routes are complete.

## Phase 2 — Calibration Approval

- Use the private Supabase dashboard for owner review and approval.
- Keep public reader accounts out of the MVP.
- Revisit a dedicated editor interface only after the newsroom output is calibrated.

## Phase 3 — Core Newsroom Engine

- Build category-specific retrieval.
- Normalize and validate source timestamps.
- Implement deduplication and original-source preference.
- Compare candidates with archived coverage for material newness.
- Implement weighted editorial scoring and hard editorial rules.
- Add final variety, topic-balance, and credibility checks.
- Generate concise conversational summaries, attribution, and structured topics.
- Freeze one edition per day.

Implementation status: the manual runner now validates the Pacific cutoff, normalizes URLs, deduplicates exact candidates, calculates the agreed weighted score, selects up to four stories per section, emits a calibration report, and can save private drafts when server credentials are configured. The OpenAI Responses API retrieval adapter is implemented with web search, strict output, and per-section runs. Its key is authenticated, but live retrieval awaits active API billing/quota. Archive-aware newness, final AI briefing generation, and richer diversity checks remain.

## Phase 4 — Core Website

- Build the Today / Daily Edition experience.
- Render sections in the agreed order.
- Present source attribution, source links, publication times, and clickable hashtags.
- Ensure quiet sections do not produce filler.
- Support section-appropriate editorial voice without a "Why it matters" block.

## Phase 5 — Archive and Topic Discovery

- Build permanent edition storage and archive-by-date browsing.
- Add previous/next date navigation and a calendar picker.
- Build topic/hashtag pages spanning archived stories.
- Add all-time, today, 7-day, 30-day, and custom date filters.

Implementation status: the backend endpoints and secured database views for edition lists, topic lists, and topic/date results are complete. Frontend wiring remains.

## Phase 6 — Scheduling, Reliability, and Launch

- Schedule the production run for 6:00 AM Pacific with correct timezone handling.
- Add failure handling, observability, and a safe publication process.
- Verify that post-cutoff stories roll into the following edition.
- Validate archive immutability and topic/date query behavior.
- Test editorial quality, source provenance, summary accuracy, and duplicate suppression.

## Later Phases

- Archive search.
- Combined topic, category, and date filters.
- Story timelines and related-topic discovery.
- Personalization and user accounts.
- Email briefings.
- Richer source-diversity and trending signals.

Priorities, milestones, owners, and dates are TBD.
