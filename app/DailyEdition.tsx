"use client";

import { FormEvent, useState } from "react";
import { SECTION_ORDER, type Edition, type EditionSummary, type SearchStory, type SectionSlug, type TopicStory, type TopicSummary } from "../lib/news/types";

const SECTION_META: Record<SectionSlug, { label: string; emoji: string }> = {
  usa: { label: "USA", emoji: "🌎" },
  california: { label: "California", emoji: "🐻" },
  world: { label: "World", emoji: "🌍" },
  "tech-ai": { label: "Tech + AI", emoji: "🤖" },
  "science-planet": { label: "Science + Planet", emoji: "🔬" },
  "health-wellness": { label: "Health + Wellness", emoji: "🧠" },
  "money-economy": { label: "Money + Economy", emoji: "📈" },
  "politics-policy": { label: "Politics + Policy", emoji: "🏛️" },
  "jobs-work": { label: "Jobs + Work", emoji: "💼" },
  sports: { label: "Sports", emoji: "🏟️" },
  "internet-trends": { label: "Internet + Trends", emoji: "📡" },
  gaming: { label: "Gaming", emoji: "🎮" },
  "life-society": { label: "Life + Society", emoji: "🫂" },
  "pop-culture": { label: "Pop Culture", emoji: "🎬" },
  "other-notable": { label: "Other Notable", emoji: "✦" },
};

function displayDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    ...options,
  }).format(new Date(`${value}T12:00:00Z`));
}

type View = "today" | "archive" | "topics" | "search";

export function DailyEdition({ edition, editions, topics }: { edition: Edition | null; editions: EditionSummary[]; topics: TopicSummary[] }) {
  const [light, setLight] = useState(false);
  const [open, setOpen] = useState<Set<SectionSlug>>(() => new Set(SECTION_ORDER));
  const [view, setView] = useState<View>("today");
  const [archiveEdition, setArchiveEdition] = useState<Edition | null>(edition);
  const [topicStories, setTopicStories] = useState<TopicStory[]>([]);
  const [topicName, setTopicName] = useState("");
  const [query, setQuery] = useState("");
  const [searchStories, setSearchStories] = useState<SearchStory[]>([]);
  const [loading, setLoading] = useState(false);

  if (!edition) {
    return (
      <main className="tea-shell tea-empty">
        <p className="tea-kicker">Your Daily Tea</p>
        <h1>No edition is on the table yet.</h1>
        <p>The next frozen briefing will appear here after publication.</p>
      </main>
    );
  }

  const date = displayDate(edition.editionDate, { month: "short", day: "numeric", year: "numeric" });
  const longDate = displayDate(edition.editionDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const toggle = (slug: SectionSlug) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    return next;
  });

  async function pickEdition(date: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/editions/${date}`);
      if (!response.ok) throw new Error("Edition unavailable");
      setArchiveEdition(await response.json());
    } finally { setLoading(false); }
  }

  async function pickTopic(topic: TopicSummary) {
    setView("topics"); setTopicName(topic.name); setLoading(true);
    try {
      const response = await fetch(`/api/topics/${topic.slug}?range=all`);
      if (!response.ok) throw new Error("Topic unavailable");
      setTopicStories((await response.json()).stories);
    } finally { setLoading(false); }
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) throw new Error("Search unavailable");
      setSearchStories((await response.json()).stories);
    } finally { setLoading(false); }
  }

  const renderStory = (story: Edition["sections"][SectionSlug] extends (infer T)[] | undefined ? T : never, dateLabel?: string) => (
    <article className="tea-story" key={`${dateLabel ?? "today"}-${story.id}`}>
      <h2><span aria-hidden="true">›</span><a href={story.canonicalUrl} target="_blank" rel="noreferrer">{story.headline}</a></h2>
      <p>{story.summary}</p>
      <div className="tea-story-meta"><a href={story.canonicalUrl} target="_blank" rel="noreferrer">{story.sourceName}</a>{dateLabel && <span>{dateLabel}</span>}</div>
    </article>
  );

  return (
    <div className={`tea-site${light ? " is-light" : ""}`}>
      <header className="tea-header">
        <div className="tea-header-inner">
          <a className="tea-wordmark" href="#top">Your Daily Tea</a>
          <nav aria-label="Primary navigation">
            {(["today", "archive", "topics", "search"] as View[]).map((item) => <button aria-current={view === item ? "page" : undefined} key={item} onClick={() => setView(item)}>{item}</button>)}
          </nav>
          <div className="tea-date-tools">
            <time dateTime={edition.editionDate}>{date}</time>
            <button aria-label={`Switch to ${light ? "dark" : "light"} theme`} onClick={() => setLight((value) => !value)}>
              {light ? "●" : "○"}
            </button>
          </div>
        </div>
      </header>

      <main className="tea-main" id="top">
        {view === "today" && <><section className="tea-intro" id="edition">
          <h1>Morning, internet.</h1>
          <div className="tea-intro-lower">
            <div>
              <p className="tea-kicker">Edition {edition.editionNumber} · {longDate}</p>
              <p className="tea-deck">Here&apos;s what happened.</p>
            </div>
            <div className="tea-controls">
              <button onClick={() => setOpen(new Set(SECTION_ORDER))}>Expand all</button>
              <button onClick={() => setOpen(new Set())}>Collapse all</button>
            </div>
          </div>
        </section>

        <div className="tea-sections">
          {SECTION_ORDER.map((slug, index) => {
            const stories = edition.sections[slug] ?? [];
            const isOpen = open.has(slug);
            const meta = SECTION_META[slug];
            return (
              <section className="tea-section" id={slug} key={slug}>
                <button className="tea-section-toggle" aria-expanded={isOpen} onClick={() => toggle(slug)}>
                  <span className="tea-section-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="tea-section-title">{meta.emoji} {meta.label}</span>
                  <span className="tea-section-count">{stories.length ? `${stories.length} ${stories.length === 1 ? "story" : "stories"}` : "—"}</span>
                  <span className="tea-section-glyph" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <div className="tea-story-list">
                    {stories.map((story) => (
                      <article className="tea-story" key={story.id}>
                        <h2><span aria-hidden="true">›</span><a href={story.canonicalUrl} target="_blank" rel="noreferrer">{story.headline}</a></h2>
                        <p>{story.summary}</p>
                        <div className="tea-story-meta">
                          <a href={story.canonicalUrl} target="_blank" rel="noreferrer">{story.sourceName}</a>
                          <time dateTime={story.publishedAt}>{new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(story.publishedAt))}</time>
                          <div className="tea-tags" aria-label="Topics">
                            {story.topics.map((topic) => <span key={topic.slug}>#{topic.name.replace(/^#/, "")}</span>)}
                          </div>
                        </div>
                      </article>
                    ))}
                    {!stories.length && <p className="tea-no-stories">Nothing here today. Quiet is information too.</p>}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <footer className="tea-footer">
          <span aria-disabled="true">← Previous edition</span>
          <span>Edition frozen 06:00 Pacific</span>
          <span aria-disabled="true">Next edition →</span>
        </footer>
        </>}

        {view === "archive" && <section className="tea-view">
          <p className="tea-kicker">Frozen daily editions</p><h1>The archive</h1><p className="tea-deck">Pick a date and read exactly what ran that day.</p>
          <div className="tea-choice-grid">{editions.map((item) => <button className="tea-choice" key={item.id} onClick={() => pickEdition(item.editionDate)}><strong>{displayDate(item.editionDate, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</strong><span>Edition {item.editionNumber}</span></button>)}</div>
          {loading && <p className="tea-status">Loading…</p>}
          {archiveEdition && <div className="tea-archive-results"><h2>{displayDate(archiveEdition.editionDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h2>{SECTION_ORDER.map((slug) => (archiveEdition.sections[slug] ?? []).map((story) => renderStory(story)))}</div>}
        </section>}

        {view === "topics" && <section className="tea-view">
          <p className="tea-kicker">Follow the threads</p><h1>Topics</h1><p className="tea-deck">Every hashtag is a thread you can pull.</p>
          <div className="tea-choice-grid tea-topic-grid">{topics.map((topic) => <button className="tea-choice" key={topic.slug} onClick={() => pickTopic(topic)}><strong>#{topic.name.replace(/^#/, "")}</strong><span>{topic.storyCount} {topic.storyCount === 1 ? "story" : "stories"}</span></button>)}</div>
          {loading && <p className="tea-status">Loading…</p>}
          {topicName && !loading && <div className="tea-archive-results"><h2>#{topicName.replace(/^#/, "")}</h2>{topicStories.map((story) => renderStory(story, displayDate(story.editionDate, { month: "short", day: "numeric", year: "numeric" })))}</div>}
        </section>}

        {view === "search" && <section className="tea-view">
          <p className="tea-kicker">Published editions only</p><h1>Search the archive</h1>
          <form className="tea-search" onSubmit={submitSearch}><label htmlFor="archive-search">Search</label><input id="archive-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="AI jobs"/><button type="submit">Search</button></form>
          {loading && <p className="tea-status">Searching…</p>}
          {!loading && searchStories.length > 0 && <div className="tea-archive-results"><h2>{searchStories.length} results</h2>{searchStories.map((story) => renderStory(story, displayDate(story.editionDate, { month: "short", day: "numeric", year: "numeric" })))}</div>}
          {!loading && query.length >= 2 && searchStories.length === 0 && <p className="tea-status">Nothing matched that phrase.</p>}
        </section>}
      </main>
    </div>
  );
}
