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

Implementation status: calibration completed with the August 18 edition. DEC-020 superseded daily manual approval with automatic fail-closed publication; no public editor interface is required.

## Phase 3 — Core Newsroom Engine

- Build category-specific retrieval.
- Normalize and validate source timestamps.
- Implement deduplication and original-source preference.
- Compare candidates with archived coverage for material newness.
- Implement weighted editorial scoring and hard editorial rules.
- Add final variety, topic-balance, and credibility checks.
- Generate concise conversational summaries, attribution, and structured topics.
- Freeze one edition per day.

Implementation status: a resumable full-edition command runs all 15 sections through discovery, Luna evaluation, deduplication, archive comparison, scoring, balanced selection, and a grounded final cross-section review. Applied to the first closed-window report, final review reduced 44 stories to 41, moved three miscategorized stories, removed two duplicate-event records, and rebalanced the affected sections. The Iran and Tupac duplicate issues identified in manual review were both resolved. The exact 41-story August 18 edition completed the guarded `draft -> approved -> published` flow. Anonymous reads were empty before publication and returned exactly one edition with 41 stories afterward. Material-development exceptions remain.

## Phase 4 — Core Website

- Build the Today / Daily Edition experience.
- Render sections in the agreed order.
- Present source attribution, source links, publication times, and clickable hashtags.
- Ensure quiet sections do not produce filler.
- Support section-appropriate editorial voice without a "Why it matters" block.

Implementation status: the finished reader now server-renders the latest published Supabase edition inside the preserved supplied design. The first edition renders 41 real stories across 14 non-empty sections while retaining all 15 section headers, including the intentionally empty Internet + Trends section. Story links, source attribution, publication times, topic labels, section controls, theme control, and responsive layout are wired. Archive loads frozen editions by date; Topics browses all published hashtags and their stories; Search queries published headlines and summaries with all-date, 7-day, 30-day, and category filters.

## Phase 5 — Archive and Topic Discovery

- Build permanent edition storage and archive-by-date browsing.
- Add previous/next date navigation and a calendar picker.
- Build topic/hashtag pages spanning archived stories.
- Add all-time, today, 7-day, 30-day, and custom date filters.

Implementation status: the backend endpoints and secured database views for edition lists, topic lists, and topic/date results are complete. Today, Archive, Topics, and Search are wired in the frontend; additional custom-range controls remain.

The first published edition is available to those endpoints and powers Today, Archive, Topics, and Search against real frozen data.

## Phase 6 — Scheduling, Reliability, and Launch

- Schedule the production run immediately after the 6:00 AM Pacific cutoff with correct timezone handling.
- Add failure handling, observability, and a safe publication process.
- Verify that post-cutoff stories roll into the following edition.
- Validate archive immutability and topic/date query behavior.
- Test editorial quality, source provenance, summary accuracy, and duplicate suppression.

Implementation status: a timezone-aware GitHub Actions workflow runs at 6:07 AM Pacific and automatically publishes editions that pass the grounded editorial pipeline plus minimum story and section gates. Failed runs leave the last published edition live. Operational logs remain available in GitHub Actions, while unpublished review files are not uploaded to the public repository.

## Later Phases

- Story timelines and related-topic discovery.
- Personalization and user accounts.
- Email briefings.
- Richer source-diversity and trending signals.

Priorities, milestones, owners, and dates are TBD.
