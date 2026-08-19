# Product

## Vision

Build a daily AI-curated news website that answers:

> Out of everything that happened yesterday, what are the stories actually worth knowing this morning?

The product should feel like a smart, concise morning briefing rather than an endless news feed. Its permanent archive should also provide a day-by-day record of what was knowable at each morning's cutoff.

## Problem

Readers face too much repetitive, low-value news spread across many sources. Finding the important, interesting, credible, and genuinely new stories takes time. Traditional importance rankings can also overlook stories that are especially relevant or compelling to a younger digital audience.

## Target Users

- Generally curious readers who want a broad daily catch-up.
- A broad, younger digital audience, with particular interest in technology, AI, work, money, culture, and internet trends.

## Value Proposition

- A frozen morning edition that can be read in roughly 10 minutes.
- Editorial selection based on importance, interestingness, audience relevance, newness, source quality, and momentum.
- No filler: quiet categories may contain no stories.
- A permanent, searchable archive that connects related coverage across dates through topics displayed as hashtags.

## Core User Journey

1. A reader visits the website in the morning.
2. The reader sees that day's frozen edition, beginning with Top Stories.
3. The reader scans concise story briefings across the 13 agreed sections.
4. The reader can follow the attributed source for more detail.
5. The reader can open an earlier edition by date.
6. The reader can click a hashtag/topic to see matching archived stories, then narrow them by date.

## Product Principles

- **Respect the cutoff.** Each edition contains only material from its defined 24-hour window.
- **Curate, do not merely aggregate.** Select what a curious reader would be glad to have learned that morning.
- **No forced filler.** A subject section may have zero stories.
- **Reward genuine newness.** Recycled commentary and duplicate coverage do not become separate stories.
- **Balance importance and interest.** Significant world events remain visible, while surprising or highly relevant stories can also earn space.
- **Prefer credible, original evidence.** Trending signals aid discovery but do not establish factual truth.
- **Be concrete.** Prefer specific events, findings, people, products, and numbers over vague trend summaries.
- **Keep the voice human.** Briefings are concise and conversational, with tone adjusted appropriately by section.
- **Do not tell readers what to think.** There is no recurring "Why it matters" block.
- **Preserve editions.** Published editions are not retrospectively rewritten as later news develops.

## MVP

- Generate one frozen edition every day at 6:00 AM Pacific.
- Use the prior 24-hour window: 6:00 AM on the previous day through 5:59 AM on the edition date.
- Retrieve candidates separately for each subject category.
- Verify timestamps, deduplicate, check credibility and newness, score candidates, and make a final editorial selection.
- Publish concise story summaries with source attribution, source links, publication time, and topics/hashtags.
- Generate Top Stories from stories already selected for the subject categories.
- Show today's edition and permanent archived editions by date.
- Support topic/hashtag filtering across archived stories with date filters.

## In Scope

- Daily automated research, selection, summarization, tagging, storage, and publishing.
- The agreed 13-section briefing.
- Category-specific retrieval rather than one broad search followed by categorization.
- Short original summaries that link back to source reporting.
- Topic entities displayed as clickable hashtags.
- Archive browsing by date and topic filtering with date constraints.

## Out of Scope

- Reproducing source articles in full.
- Generating an edition on every page request.
- Filling a fixed story quota for each section.
- Retrieving a separate pool for Top Stories.
- Retrospectively adding post-cutoff developments to an older edition.
- Story timelines in the MVP.
- Personalization, email briefings, and user accounts until further decisions are made.

## Future Ideas

- Search across the archive.
- Combined topic, category, and date filters.
- Story timelines that connect an ongoing event across editions.
- Related-topic discovery and topic overview pages.
- Personalization, email briefings, and user accounts.
- Source-diversity scoring and richer trending detection.

## Success Metrics

TBD. No quantitative product success metrics have been agreed yet.

