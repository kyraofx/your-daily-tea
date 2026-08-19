# Decisions

## DEC-001 — Use PostgreSQL

- **Status:** Accepted

### Context

The product needs to preserve immutable daily editions, place stories in ranked subject sections, and query archived stories by structured topic and date. The requested project documents explicitly identify PostgreSQL as DEC-001, and the earlier architecture discussion proposed Postgres/Supabase for storage.

### Decision

Use PostgreSQL as the primary database for editions, stories, categories, placements, sources, topics, and their relationships.

### Alternatives Considered

- Another unspecified database.
- Supabase as a PostgreSQL-based platform option.

No detailed database comparison has been completed.

### Why

The product's core data is relational: editions contain ranked story placements, stories connect to categories and many topics, and archive queries combine topic and date constraints. PostgreSQL fits this model and supports the agreed archive behavior.

### Consequences

- The schema must distinguish stories from their ranked edition placements.
- Topics should be normalized entities with many-to-many story relationships, not a single hashtag string.
- Edition timestamps and publication windows must preserve Pacific-time cutoff semantics.
- Hosting provider, schema details, migrations, indexing, backups, and operational ownership remain TBD.

## DEC-002 — Publish Frozen Daily Editions

- **Status:** Accepted

### Context

The archive is intended to show what was knowable at each morning's cutoff, not a retrospectively edited page.

### Decision

Generate and save one edition at 6:00 AM Pacific using the window from 6:00 AM the previous day through 5:59 AM on the edition date. Later developments belong to the next edition.

### Alternatives Considered

- A continuously updating news feed.
- Regenerating content whenever a reader loads the site.

### Why

Frozen editions create a trustworthy day-by-day record, give all visitors the same briefing, and avoid repeated generation cost and inconsistency.

### Consequences

- Publication timestamps must be validated precisely.
- Old editions must not be silently overwritten.
- Corrections policy is TBD.

## DEC-003 — Generate Top Stories from Selected Category Stories

- **Status:** Superseded by DEC-010

### Context

Top Stories is a front-page ranking, not a distinct news domain.

### Decision

Retrieve and select subject-category stories first, then promote approximately 3–5 of those stories into Top Stories while retaining their original category and metadata.

### Alternatives Considered

- Run a separate Top Stories retrieval pool.

### Why

This avoids duplicate research logic and keeps the front page grounded in the fully reviewed edition.

### Consequences

- Generation order and reader display order differ.
- The data model must support multiple placements for one story.

## DEC-004 — Use Structured Topics Displayed as Hashtags

- **Status:** Accepted

### Context

Readers need to follow a subject across archived editions and narrow results by date.

### Decision

Store topics as structured entities linked to stories, while displaying them as clickable hashtags.

### Alternatives Considered

- Store hashtags only as unstructured text on each story.

### Why

Structured topics support reliable topic/date filtering and future timelines or related-topic features.

### Consequences

- Topic normalization and many-to-many story relationships are required.
- Topic naming, aliases, and merge rules are TBD.

## DEC-005 — Select with Weighted Editorial Scoring and Hard Rules

- **Status:** Accepted

### Context

Retrieval can produce hundreds of candidates, but the product's value comes from choosing the limited set worth a reader's morning attention.

### Decision

Use weighted scoring—importance 25%, interestingness 20%, audience relevance 20%, newness 15%, source quality 15%, and momentum 5%—followed by editorial rules and a final diversity pass. Do not enforce fixed story counts.

### Alternatives Considered

- Let an AI vaguely determine importance.
- Publish every story above a fixed score.
- Fill a fixed quota in every category.

### Why

The combined approach balances consequence, curiosity, relevance, credibility, and novelty while preventing filler and topic domination.

### Consequences

- Scores support rather than replace editorial judgment.
- Categories may be empty.
- Evaluation and calibration methods are TBD.

## DEC-006 — Use a Concise Conversational Briefing Format

- **Status:** Accepted

### Context

The desired experience is a modern morning catch-up, not a formal or old-fashioned newspaper summary.

### Decision

Present concise, concrete story briefings with source attribution and hashtags. Adjust voice by section while remaining factual. Do not include a standard "Why it matters" block.

### Alternatives Considered

- A uniform wire-service tone.
- A repeated "Why it matters" section for every story.

### Why

This keeps the edition fast, approachable, and less prescriptive.

### Consequences

- Editorial prompts and quality checks must enforce clarity, specificity, and factual neutrality.
- Especially relevant context may appear inline only when genuinely useful.

## DEC-007 — Use the Supplied 15-Section Taxonomy

- **Status:** Accepted

### Decision

Use the confirmed section structure: USA, California, World, Tech + AI, Science + Planet, Health + Wellness, Money + Economy, Politics + Policy, Jobs + Work, Sports, Internet + Trends, Gaming, Life + Society, Pop Culture, and Other Notable.

## DEC-008 — Use Supabase PostgreSQL

- **Status:** Accepted

### Decision

Use Supabase to host PostgreSQL and expose published content through a row-level-security-protected Data API. The Sites application uses a browser-safe publishable key; newsroom credentials remain server-only.

## DEC-009 — Require Approval During Calibration

- **Status:** Accepted

### Decision

Generate editions as private drafts. During calibration, the owner reviews each edition in the private Supabase dashboard, records approval, and publishes it explicitly. Public readers can access only editions in the `published` state.

Published editions are immutable, and the database rejects transitions that skip approval.

## DEC-010 — Remove Top Stories

- **Status:** Accepted

### Decision

Do not generate or display a Top Stories section. The product has 15 ranked subject sections, beginning with USA, California, and World. Each selected story appears only in its subject section.
