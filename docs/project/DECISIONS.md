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
- Supabase hosts PostgreSQL; the implemented migration defines the schema, indexes, RLS policies, security-invoker views, and immutable publication trigger. Backup and long-term retention policy remains to be formalized.

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

- **Status:** Superseded in part by DEC-025

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
- Deterministic validation, weighted scoring, Luna evaluation, source caps, archive deduplication, and grounded cross-section review implement the evaluation method.

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

- **Status:** Superseded by DEC-020 for production

### Decision

Generate editions as private drafts. During calibration, the owner reviews each edition in the private Supabase dashboard, records approval, and publishes it explicitly. Public readers can access only editions in the `published` state.

Published editions are immutable, and the database rejects transitions that skip approval.

## DEC-010 — Remove Top Stories

- **Status:** Accepted

### Decision

Do not generate or display a Top Stories section. The product has 15 ranked subject sections, beginning with USA, California, and World. Each selected story appears only in its subject section.

## DEC-011 — Use OpenAI Responses for Candidate Retrieval

- **Status:** Accepted

### Decision

Use the OpenAI Responses API with web search to research each section independently. Require strict structured candidate output, keep the model configurable, and default to the cost-sensitive `gpt-5.6-luna` with reasoning disabled during calibration.

### Consequences

- Retrieval writes a private candidate file; it does not publish.
- Cutoff validation, scoring, and draft creation remain separate gates. Production automation advances passing editions through the guarded approval and publication transitions under DEC-020.
- Production use requires an OpenAI API project with active billing and quota.

## DEC-012 — Separate Deterministic Discovery from AI Evaluation

- **Status:** Accepted

### Decision

Collect timestamped candidates from a configurable RSS/Atom source registry before AI evaluation. Treat feeds as discovery metadata—headline, short description, timestamp, attribution, and link—not as content to republish.

### Consequences

- A temporary AI or web-search failure cannot make a newsworthy section appear empty.
- Feed candidates still require category cleanup, deduplication, credibility checks, scoring, and grounded final editorial review.
- Source balance and publisher usage must be monitored as the registry expands.

## DEC-013 — Deduplicate Against the Current Pool and Published Archive

- **Status:** Accepted

### Decision

Before final selection, merge matching canonical URLs and highly similar headlines published within 48 hours, preferring the higher-scoring or higher-source-quality candidate. Compare remaining candidates with the prior 30 days of published archive stories and reject repeated coverage unless a later material-newness capability marks a genuine development.

### Consequences

- Duplicate outlet coverage and accidental cross-section repetition are reduced deterministically.
- Only published editions establish archive precedent; drafts do not suppress future coverage.
- The similarity threshold and material-development exception require ongoing calibration.

## DEC-014 — Ground AI Output and Enforce Source Balance

- **Status:** Accepted

### Decision

Assign source quality deterministically from a reviewed registry tier rather than accepting an AI-generated credibility score. Ground every evaluated story back to its supplied URL, headline, source, and timestamp. Allow at most two stories from one source in a section and six across a complete edition.

### Consequences

- Luna cannot introduce an unknown URL or silently alter source provenance.
- Publisher-specific stable story IDs may resolve harmless headline-slug variations only when the match is unique; the supplied feed URL remains authoritative.
- Primary and established reporting sources receive consistent scoring.
- A section may contain fewer than four stories when its shortlist lacks source diversity.
- Registry tiers and caps require periodic editorial review.

## DEC-015 — Generate Resumable Private Edition Reports

- **Status:** Accepted

### Decision

Run all 15 sections through one manually invoked, resumable calibration command. Checkpoint each section, then write private candidate, deduplication, manifest, and final review files. Do not combine generation with database saving or publication.

### Consequences

- Transient failures can resume without repeating completed Luna calls.
- The owner can inspect the entire frozen edition before authorizing a Supabase draft.
- Final cross-section editorial review remains a required gate during calibration.

## DEC-016 — Require a Grounded Cross-Section Editorial Pass

- **Status:** Accepted

### Decision

After deterministic selection, review the complete edition in one structured Luna pass. Permit only keep, remove, or move decisions for the exact supplied story URLs, validate complete one-to-one decision coverage, and reapply deterministic topic and source balance afterward.

### Consequences

- Low-similarity duplicate events and section leakage can be caught with full-edition context.
- The model cannot add stories, alter provenance, or invent URLs during final review.
- The final report remains private and still requires owner approval before database saving.

## DEC-017 — Persist Reviewed Reports as Non-Overwriting Private Drafts

- **Status:** Accepted

### Decision

Save only the final cross-section review artifact through a dedicated server-side command. Refuse to overwrite an edition date, decode residual HTML entities before storage, and insert only the `draft` state. Keep approval and publication as later, explicit owner-controlled transitions.

### Consequences

- The stored edition is the exact reviewed selection rather than an earlier candidate or selection checkpoint.
- Retrying cannot silently replace a calibration edition; partial failures are visibly marked `failed`.
- The August 18, 2026 calibration edition is stored with 41 placements and remains invisible through anonymous Data API reads.

## DEC-018 — Complete the First Publication Through Separate Owner Gates

- **Status:** Accepted

### Decision

Use distinct owner instructions for approval and publication during calibration. For the August 18, 2026 edition, transition from `draft` to `approved` only after content review, then transition from `approved` to `published` only after a separate publication instruction.

### Consequences

- The first edition exercised the database-enforced state machine without skipping a gate.
- Publishable-key reads returned no private content before publication and exactly 41 stories afterward.
- The published edition is immutable and can now support end-to-end website and archive integration testing.

## DEC-019 — Number Editions by Published Chronology

- **Status:** Accepted

### Decision

Show readers a consecutive edition number derived from the chronological order of successfully published editions. Drafts, failed calibration saves, and internal database identity gaps do not consume a public edition number.

### Consequences

- The August 18, 2026 publication is Edition 1 even though earlier failed calibration inserts consumed internal identity values.
- Today, Archive, and edition API responses use the same reader-facing number.
- Published database rows remain immutable; correcting presentation does not rewrite publication history or weaken the transition guard.

## DEC-020 — Automate Daily Publication with Fail-Closed Quality Gates

- **Status:** Superseded in part by DEC-025

### Decision

Run the complete newsroom workflow every day at 6:07 AM in `America/Los_Angeles`. After deterministic validation and Luna's grounded editorial review, automatically advance a qualifying edition through `draft`, `approved`, and `published`. This decision originally required at least 20 stories across at least 10 populated sections; DEC-025 replaces those thresholds with two qualifying stories in all 15 sections and at least 30 total.

### Consequences

- Daylight-saving changes are handled by the scheduler's named Pacific timezone.
- Publication no longer requires daily owner action.
- Duplicate scheduled or manual retries cannot overwrite an existing edition date.
- GitHub stores the Supabase and OpenAI credentials as encrypted repository secrets. Workflow logs retain operational progress, but unpublished review files are not uploaded because the repository is public.

## DEC-021 — Add Cost-Safe Schedule Redundancy

- **Status:** Accepted

### Decision

Keep 6:07 AM Pacific as the primary daily start, then schedule backup attempts at 6:22, 6:37, 6:52, and 7:07. Before dependency installation or AI generation, query the public edition-by-date endpoint. Skip the remaining newsroom work when that date is already published, continue only on a confirmed `404`, and fail closed on any other response.

### Consequences

- A delayed or dropped GitHub schedule has four additional chances to start without owner intervention.
- Successful backup attempts do not repeat Luna generation or incur its associated model cost.
- The existing concurrency group prevents overlapping workflow jobs, while the database remains the final non-overwrite guard.
- GitHub Actions remains a best-effort scheduler, so publication near 6:07 AM is substantially more resilient but not a hard real-time guarantee.

## DEC-022 — Add an Independent Publication Watchdog

- **Status:** Accepted

### Decision

Keep GitHub's timezone-aware schedule, retain all delayed GitHub attempts with a queued concurrency group, and operate an independent watchdog at 6:12, 6:32, 6:52, 7:12, 7:32, and 7:52 AM Pacific. The watchdog checks the public date endpoint, monitors an active run, or dispatches the existing Daily edition workflow only when today's edition is absent.

### Consequences

- GitHub is no longer the only clock capable of starting the newsroom.
- The same generation, editorial review, minimum-story, minimum-section, transition, idempotence, and immutability safeguards apply regardless of which clock starts the run.
- Successful publication makes later checks no-ops, avoiding repeat Luna generation.
- Deterministic or quality-gate failures are reported rather than bypassed or retried indefinitely.

## DEC-023 — Enforce Diversity by Publisher, Not Feed Label

- **Status:** Accepted

### Decision

Assign a stable publisher identity to desk-specific feeds and use that identity for section- and edition-wide diversity limits. NPR, BBC, and The New York Times each count as one publisher even when their US, world, business, science, sports, or arts feeds use different labels.

### Consequences

- A publisher cannot bypass the two-per-section or six-per-edition limits through multiple feeds.
- Feed-specific source labels remain available for attribution while publisher identity controls balance.
- Existing frozen editions are not rewritten; the corrected limits apply to newly generated editions.

## DEC-024 — Ground AI Decisions Through Opaque Record IDs

- **Status:** Accepted

### Decision

Assign temporary deterministic IDs to the feed candidates sent for category evaluation and the selected stories sent for final editorial review. Constrain the structured-output schemas to those exact IDs, validate complete and non-duplicated references, and resolve every accepted decision back to the original supplied record in deterministic code. Do not ask the model to reproduce URLs as decision identifiers.

### Consequences

- Harmless model edits to publisher URL paths cannot block an otherwise valid edition.
- The model cannot introduce a different source record because only supplied IDs are accepted.
- Exact feed URLs, headlines, attribution, timestamps, publisher identities, and source-quality scores remain under deterministic control.
- Unknown, duplicated, omitted, or invalid references continue to fail closed.

## DEC-025 — Require Two Qualifying Stories in Every Section

- **Status:** Accepted

### Decision

For newly generated editions, reserve two qualifying placements for every one of the 15 sections before assigning third and fourth stories. Prioritize sections with fewer eligible alternatives during reservation so the fixed display order cannot exhaust a shared publisher's edition-wide allowance. After grounded final review and deterministic rebalancing, require at least two stories in every section and at least 30 stories total before automatic publication.

Never weaken the score threshold, coverage window, provenance grounding, deduplication, topic diversity, source caps, editorial review, database transition guard, or published-edition immutability to satisfy the minimum. If any section remains underfilled, fail closed and keep the previous published edition live.

### Consequences

- Every newly published edition has visible coverage in all 15 sections.
- Sports, Internet + Trends, and other later sections receive their minimum opportunity before earlier sections consume shared publisher capacity.
- A genuinely quiet section can prevent that day's new edition from publishing; this is preferable to filler under the requested coverage guarantee.
- Previously published editions remain frozen and may still contain empty or one-story sections.

## DEC-026 — Recover Underfilled Sections Without Weakening Publication Gates

- **Status:** Accepted

### Decision

Preserve materially overlapping same-day candidates when they belong to different tentative sections until the grounded whole-edition review decides their final placement. Continue removing duplicates within a section and against the published archive.

When feed evaluation returns fewer than two qualifying stories for a section, run one bounded Luna web search for that section. Restrict discovery to the reviewed publisher domains already represented in the source registry, then deterministically reject unreviewed domains, wrong sections, and timestamps outside the Pacific coverage window. Restore publisher identity and source quality from the registry rather than trusting model-supplied values.

### Consequences

- A cross-section duplicate can no longer erase USA, Sports, or another section before final placement is decided.
- Sections whose RSS feeds omit a timely article have one additional discovery path without opening publication to arbitrary sources.
- The fallback adds model cost only for sections with fewer than two qualifying feed stories.
- The existing score, diversity, deduplication, editorial review, per-section minimum, database transition, idempotence, and immutability safeguards remain fail closed.

## DEC-027 — Review Alternates Before Final Section Balancing

- **Status:** Accepted

### Decision

Send the complete score-qualified candidate pool to grounded whole-edition review, not only the initial balanced selection. Apply every keep, move, and remove decision to that reviewed pool, then run deterministic section, topic, and publisher balancing once more. Preserve same-day duplicates across tentative sections until this review, and add TechCrunch, Mashable, and Social Media Today as reviewed specialist feeds for Internet + Trends discovery.

Treat duplicate-event removals as final. Treat a category move or broad-review low-value vote as advisory when applying it would erase the source desk below two stories that already passed its category-specific evaluation and deterministic score threshold; in that case, restore the highest-scoring candidates needed to retain the floor before final balancing. This is two-pass consensus, not filler: no candidate can enter through this arbitration unless the specialist desk already selected it and deterministic validation accepted it.

For a duplicate event represented in multiple tentative sections, keep exactly one reviewed copy. Deterministic placement may replace the reviewer's chosen copy with another reviewed copy only when the swap reduces the edition's total section deficit without creating an equal deficit elsewhere.

A duplicate-event decision is binding only when the referenced supplied pair also matches deterministic canonical-URL or headline/time evidence. Treat an unsupported semantic duplicate label as advisory at the two-story floor, because one uncorroborated whole-edition vote cannot overrule both the specialist desk and deterministic score gate for an entire section.

Order section-floor reservations by the number of currently selectable alternatives, including sections that can supply only one story. A partially fillable scarce desk selects before broad desks so its only eligible publisher capacity is not consumed elsewhere; this does not fabricate a second story or bypass the final two-story gate.

If a section remains below two after final review and duplicate placement, run one bounded recovery search restricted to its reviewed publisher domains. Exclude all already-reviewed event headlines from the request, ground the response to registry identity and the Pacific coverage window, deduplicate it against both the published archive and current selection, and rerun the normal score and balance rules. The publication gate still fails closed if the recovery pass cannot supply two unique qualifying stories.

### Consequences

- When final review moves a USA or Sports story, a reviewed alternate can fill the vacated placement instead of leaving the section empty.
- Cross-section duplicates are resolved with whole-edition context before the final balanced selection.
- Internet + Trends receives direct creator, platform, social-media, and internet-culture discovery rather than depending mainly on general technology feeds.
- The cross-section reviewer can correct categorization without reclassifying an entire qualified desk out of existence.
- Score thresholds, source caps, the two-per-section publication gate, and published-edition immutability remain unchanged.

## DEC-028 — Add Direct Education and Housing Discovery

- **Status:** Accepted

### Decision

Add reviewed education desks from NPR, BBC, and The New York Times, the New York Times real-estate desk, Inside Higher Ed, and HousingWire to the feed registry for Life + Society discovery. Preserve shared publisher identities and the existing deterministic major/specialist source tiers.

### Consequences

- Life + Society no longer depends mainly on broad national and culture feeds for education and housing news.
- The larger candidate pool gives grounded final review meaningful alternates when a story is duplicate, low-value, or better assigned elsewhere.
- The same coverage window, category evaluation, score threshold, publisher caps, and final quality gates apply.

## DEC-029 — Enforce One Placement Per Canonical Story

- **Status:** Accepted

### Decision

Permit a canonical URL only once in a complete edition, even when the same feed story was evaluated for more than one tentative section. During balanced selection, give the story to the first scarce section that can select it and let the other section use its next eligible reviewed candidate. Reject any repeated canonical URL again immediately before persistence. When an identical immutable story row already exists from an earlier partial attempt, reference that row rather than updating its content or failing on the unique key.

### Consequences

- One article can no longer satisfy the two-story floor in multiple sections.
- A cross-section duplicate cannot cause a late Supabase unique-key failure after editorial review has passed.
- Existing published story copy remains immutable; retries may reference an existing row but do not overwrite it.
- If no distinct alternate exists, the section remains short and the edition still fails closed.

## DEC-030 — Add Dedicated Workplace and Labor Discovery

- **Status:** Accepted

### Decision

Add The Guardian's Work & Careers feed, Fast Company's Work Life feed, and the U.S. Department of Labor news-release feed to Jobs + Work discovery. Treat The Guardian as a major newsroom, Fast Company as a specialist publication, and the Department of Labor as a primary source. Also permit relevant Department of Labor releases to be evaluated by Politics + Policy.

Normalize timezone-less ISO timestamps from reviewed feeds as UTC before applying the Pacific coverage boundary. Preserve any explicit timezone or numeric offset supplied by a publisher.

### Consequences

- Jobs + Work receives direct reporting on hiring, careers, workplace practices, labor conditions, and employment policy rather than relying mainly on broad business feeds.
- Primary government releases can support labor-policy coverage, while category review still rejects routine or low-value announcements.
- Every candidate still must pass the coverage window, grounded category evaluation, score threshold, deduplication, publisher caps, whole-edition review, and two-story section gate.
- Local and GitHub runs evaluate timezone-less feed timestamps against the same instant.

## DEC-031 — Apply Primary-Topic Diversity Above the Section Floor

- **Status:** Accepted

### Decision

Allow two materially distinct, specialist-approved stories in one section to share a normalized primary topic when both are needed to reach that section's two-story publication floor. Continue enforcing canonical-URL uniqueness, event/headline deduplication, the score threshold, publisher caps, provenance grounding, and whole-edition review. After the floor is filled, a third or fourth story must introduce a different primary topic.

### Consequences

- A broad label such as `AI and work` cannot cause one of two otherwise distinct qualified workplace stories to disappear.
- Topic repetition cannot be used to fill the third or fourth position in a section.
- Duplicate coverage and filler remain prohibited, and the final publication gate remains fail closed.

## DEC-032 — Reserve Section Floors by Publisher Scarcity

- **Status:** Accepted

### Decision

When reserving the first two stories for every section, order sections first by the number of distinct publishers still available to them, then by their total selectable candidates, and finally by display order. Keep the existing per-publisher section and edition caps unchanged.

### Consequences

- A section such as Sports that depends on a small publisher pool receives its floor opportunity before broad desks consume those publishers' edition-wide capacity.
- Broad sections retain their alternative publishers instead of winning shared capacity merely because they have fewer raw candidates.
- Publisher diversity limits remain fully enforced; a section still fails closed when no permitted allocation can supply two stories.

## DEC-033 — Solve Section Floors as One Bounded Assignment

- **Status:** Accepted

### Decision

Before optional stories are selected, search the bounded set of valid per-section floor combinations as one assignment under canonical-URL and publisher caps. Prefer higher-scoring combinations, cap the search, and retain the existing scarcity-ordered fail-closed fallback when no complete assignment can be found.

### Consequences

- A locally strong publisher choice cannot consume capacity required for another section's second story.
- The algorithm does not invent candidates or weaken any source, duplicate, topic, or publisher constraint.
- If a complete two-per-section assignment does not exist, the edition remains held.

## DEC-034 — Expand Dedicated Gaming Discovery

- **Status:** Accepted

### Decision

Add the reviewed Eurogamer, PC Gamer, and Rock Paper Shotgun feeds to Gaming discovery as specialist publishers.

### Consequences

- Gaming has timely alternatives when one of its initially selected stories is removed or moved during whole-edition review.
- All added candidates remain subject to the Pacific window, grounded category review, score threshold, deduplication, publisher caps, and final two-story gate.

## DEC-035 — Expand Dedicated Politics Discovery

- **Status:** Accepted

### Decision

Add NPR Politics and The Guardian's US Politics feed to Politics + Policy discovery, retaining their shared publisher identities and major-newsroom source tier.

### Consequences

- Politics + Policy has timely alternatives when overlapping national coverage is removed during whole-edition review.
- The Pacific window, category review, deduplication, publisher caps, and final two-story gate remain unchanged.

## DEC-036 — Expand Dedicated Health Discovery

- **Status:** Accepted

### Decision

Add The Guardian Health, KFF Health News, and STAT feeds to Health + Wellness discovery. Preserve The Guardian's shared publisher identity; treat KFF Health News and STAT as specialist health publishers.

### Consequences

- Health + Wellness has independent reporting alternatives when broad national coverage overlaps with another section.
- Every candidate remains subject to the Pacific window, category review, source scoring, deduplication, publisher caps, and final two-story gate.

## DEC-037 — Require Strong Evidence for Final Duplicate Removal

- **Status:** Accepted

### Decision

Treat a whole-edition duplicate removal as binding only when the normalized canonical URLs match or the two in-window headlines meet a strong 0.70 token-similarity threshold. Continue treating unsupported model duplicate labels as advisory only when needed to preserve a section floor.

### Consequences

- Generic shared terms such as an institution, market, or policy area cannot erase otherwise distinct reporting.
- Exact URLs and strongly matching event headlines still deduplicate across sections.
- The two-story gate, one-placement-per-event rule, and fail-closed behavior remain intact.

## DEC-038 — Expand Dedicated Economy Discovery

- **Status:** Accepted

### Decision

Add The Guardian Business and Fortune feeds to Money + Economy discovery. Preserve The Guardian's shared publisher identity and treat Fortune as a specialist business publisher.

### Consequences

- Money + Economy has independent alternates when one of two initial stories overlaps with another section.
- Existing time, category, score, duplicate, publisher, and publication gates remain unchanged.

## DEC-039 — Expand Dedicated USA Discovery

- **Status:** Accepted

### Decision

Add The Guardian's U.S. News feed to USA discovery while preserving The Guardian's shared publisher identity and major-newsroom source tier.

### Consequences

- USA has an additional direct national-news source when broad desk candidates are moved or removed during whole-edition review.
- Existing Pacific-window, category-review, score, deduplication, publisher-cap, and two-story publication gates remain unchanged.
