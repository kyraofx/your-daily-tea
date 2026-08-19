"use client";

import { useState } from "react";
import { SECTION_ORDER, type Edition, type SectionSlug } from "../lib/news/types";

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

export function DailyEdition({ edition }: { edition: Edition | null }) {
  const [light, setLight] = useState(false);
  const [open, setOpen] = useState<Set<SectionSlug>>(() => new Set(SECTION_ORDER));

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

  return (
    <div className={`tea-site${light ? " is-light" : ""}`}>
      <header className="tea-header">
        <div className="tea-header-inner">
          <a className="tea-wordmark" href="#top">Your Daily Tea</a>
          <nav aria-label="Primary navigation">
            <a aria-current="page" href="#edition">Today</a>
            <span aria-disabled="true">Archive</span>
            <span aria-disabled="true">Topics</span>
            <span aria-disabled="true">Search</span>
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
        <section className="tea-intro" id="edition">
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
      </main>
    </div>
  );
}
