import { supabaseGet } from "../supabase/rest";
import type { Edition, SectionSlug, Story, Topic } from "./types";

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

