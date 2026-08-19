import { supabaseGet } from "../supabase/rest";
import type {
  Edition,
  EditionSummary,
  SectionSlug,
  Story,
  SearchStory,
  Topic,
  TopicStory,
  TopicSummary,
} from "./types";

type EditionRow = {
  id: string;
  edition_date: string;
  edition_number: number;
  coverage_starts_at: string;
  coverage_ends_at: string;
  published_at: string;
};

type StoryRow = {
  id: string;
  headline: string;
  summary: string;
  canonical_url: string;
  published_at: string;
  source_name: string;
  section_slug: SectionSlug;
  rank: number;
  topics: Topic[] | null;
};

async function hydrateEdition(row: EditionRow): Promise<Edition> {
  const stories = await supabaseGet<StoryRow[]>("published_edition_stories", {
    select: "*",
    edition_id: `eq.${row.id}`,
    order: "section_order.asc,rank.asc",
  });

  const sections: Edition["sections"] = {};
  for (const story of stories) {
    const item: Story = {
      id: story.id,
      headline: story.headline,
      summary: story.summary,
      canonicalUrl: story.canonical_url,
      sourceName: story.source_name,
      publishedAt: story.published_at,
      section: story.section_slug,
      rank: story.rank,
      topics: story.topics ?? [],
    };
    (sections[story.section_slug] ??= []).push(item);
  }

  return {
    id: row.id,
    editionDate: row.edition_date,
    editionNumber: row.edition_number,
    coverageStartsAt: row.coverage_starts_at,
    coverageEndsAt: row.coverage_ends_at,
    publishedAt: row.published_at,
    sections,
  };
}

export async function getPublishedEdition(date?: string): Promise<Edition | null> {
  const query: Record<string, string> = {
    select: "id,edition_date,edition_number,coverage_starts_at,coverage_ends_at,published_at",
    status: "eq.published",
    order: "edition_date.desc",
    limit: "1",
  };

  if (date) query.edition_date = `eq.${date}`;
  const rows = await supabaseGet<EditionRow[]>("editions", query);
  return rows[0] ? hydrateEdition(rows[0]) : null;
}

export async function listPublishedEditions(
  limit: number,
  before?: string,
): Promise<EditionSummary[]> {
  const query: Record<string, string> = {
    select: "id,edition_date,edition_number,published_at",
    status: "eq.published",
    order: "edition_date.desc",
    limit: String(limit),
  };
  if (before) query.edition_date = `lt.${before}`;

  const rows = await supabaseGet<
    Pick<EditionRow, "id" | "edition_date" | "edition_number" | "published_at">[]
  >("editions", query);

  return rows.map((row) => ({
    id: row.id,
    editionDate: row.edition_date,
    editionNumber: row.edition_number,
    publishedAt: row.published_at,
  }));
}

type TopicSummaryRow = {
  name: string;
  slug: string;
  story_count: number;
  latest_edition_date: string;
};

export async function listPublishedTopics(): Promise<TopicSummary[]> {
  const rows = await supabaseGet<TopicSummaryRow[]>("published_topics", {
    select: "name,slug,story_count,latest_edition_date",
    order: "name.asc",
  });
  return rows.map((row) => ({
    name: row.name,
    slug: row.slug,
    storyCount: row.story_count,
    latestEditionDate: row.latest_edition_date,
  }));
}

type TopicStoryRow = {
  edition_id: string;
  edition_date: string;
  story_id: string;
  headline: string;
  summary: string;
  canonical_url: string;
  published_at: string;
  source_name: string;
  section_slug: SectionSlug;
  rank: number;
  topic_name: string;
  topic_slug: string;
};

export async function listPublishedTopicStories(
  slug: string,
  from?: string,
  to?: string,
): Promise<TopicStory[]> {
  const query: Record<string, string> = {
    select: "*",
    topic_slug: `eq.${slug}`,
    order: "edition_date.desc,rank.asc",
  };
  if (from) query.edition_date = `gte.${from}`;
  if (to) query.and = `(edition_date.lte.${to}${from ? `,edition_date.gte.${from}` : ""})`;

  const rows = await supabaseGet<TopicStoryRow[]>("published_topic_stories", query);
  return rows.map((row) => ({
    editionId: row.edition_id,
    editionDate: row.edition_date,
    id: row.story_id,
    headline: row.headline,
    summary: row.summary,
    canonicalUrl: row.canonical_url,
    sourceName: row.source_name,
    publishedAt: row.published_at,
    section: row.section_slug,
    rank: row.rank,
    topic: { name: row.topic_name, slug: row.topic_slug },
  }));
}

export async function searchPublishedStories(query: string): Promise<SearchStory[]> {
  const term = query.replace(/[,*%()]/g, " ").trim();
  if (term.length < 2) return [];
  const rows = await supabaseGet<(StoryRow & { edition_id: string; edition_date: string })[]>(
    "published_edition_stories",
    {
      select: "edition_id,edition_date,id,headline,summary,canonical_url,published_at,source_name,section_slug,rank,topics",
      or: `(headline.ilike.*${term}*,summary.ilike.*${term}*)`,
      order: "edition_date.desc,rank.asc",
      limit: "100",
    },
  );
  return rows.map((row) => ({
    editionId: row.edition_id, editionDate: row.edition_date,
    id: row.id, headline: row.headline, summary: row.summary,
    canonicalUrl: row.canonical_url, sourceName: row.source_name,
    publishedAt: row.published_at, section: row.section_slug,
    rank: row.rank, topics: row.topics ?? [],
  }));
}
