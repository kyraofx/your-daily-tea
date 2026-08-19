const EXPECTED_SECTIONS = new Set([
  "usa", "california", "world", "tech-ai", "science-planet",
  "health-wellness", "money-economy", "politics-policy", "jobs-work",
  "sports", "internet-trends", "gaming", "life-society", "pop-culture",
  "other-notable",
]);

export function decodeEntities(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (match, entity) => {
    const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
    if (entity[0] !== "#") return named[entity.toLowerCase()] ?? match;
    const hex = entity[1].toLowerCase() === "x";
    const point = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(point) ? String.fromCodePoint(point) : match;
  });
}

export function createRestClient({ supabaseUrl, secretKey, fetchImpl = fetch }) {
  if (!supabaseUrl || !secretKey) throw new Error("Saving requires SUPABASE_URL and SUPABASE_SECRET_KEY.");
  return async (path, options = {}) => {
    const authorization = secretKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${secretKey}` };
    const response = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: secretKey,
        ...authorization,
        "Content-Type": "application/json",
        Prefer: options.prefer ?? "return=representation",
        ...options.headers,
      },
    });
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
}

export function validateReviewedReport(report) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(report?.editionDate ?? "")) throw new Error("The reviewed report needs an editionDate.");
  if (!report.coverageStartsAt || !report.coverageEndsAt) throw new Error("The reviewed report needs coverage boundaries.");
  if (!Array.isArray(report.selected) || report.selected.length === 0) throw new Error("The reviewed report has no selected stories.");
  if (!report.editorialReview) throw new Error("Only a final editorial-review report can be saved.");
  for (const story of report.selected) {
    if (!EXPECTED_SECTIONS.has(story.category)) throw new Error(`Unknown section: ${story.category}`);
    if (!story.headline || !story.summary || !story.canonicalUrl || !story.sourceName) throw new Error("Every story needs provenance and briefing copy.");
    if (!Array.isArray(story.topics) || story.topics.some((topic) => !topic.name || !topic.slug)) throw new Error(`${story.headline}: invalid topics.`);
  }
  return report;
}

export async function saveReviewedDraft(report, rest) {
  validateReviewedReport(report);
  const existing = await rest(`editions?edition_date=eq.${report.editionDate}&select=id,status`);
  if (existing.length) throw new Error(`Edition ${report.editionDate} already exists as ${existing[0].status}; refusing to overwrite it.`);

  const categories = await rest("categories?select=id,slug");
  const categoryIds = new Map(categories.map((item) => [item.slug, item.id]));
  const missing = [...new Set(report.selected.map((item) => item.category))].filter((slug) => !categoryIds.has(slug));
  if (missing.length) throw new Error(`Supabase is missing categories: ${missing.join(", ")}`);

  const [edition] = await rest("editions?select=id,status,edition_date", {
    method: "POST",
    body: JSON.stringify({
      edition_date: report.editionDate,
      coverage_starts_at: report.coverageStartsAt,
      coverage_ends_at: report.coverageEndsAt,
      status: "draft",
      generated_at: new Date().toISOString(),
    }),
  });

  try {
    for (const item of report.selected) {
      const domain = new URL(item.canonicalUrl).hostname.replace(/^www\./, "");
      const [source] = await rest("sources?on_conflict=domain&select=id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify({ name: decodeEntities(item.sourceName), domain, credibility_score: item.scores.sourceQuality }),
      });
      const [story] = await rest("stories?select=id", {
        method: "POST",
        body: JSON.stringify({
          category_id: categoryIds.get(item.category), source_id: source.id,
          headline: decodeEntities(item.headline), summary: decodeEntities(item.summary),
          canonical_url: item.canonicalUrl, published_at: item.publishedAt,
          importance_score: item.scores.importance, interestingness_score: item.scores.interestingness,
          relevance_score: item.scores.relevance, newness_score: item.scores.newness,
          source_quality_score: item.scores.sourceQuality, momentum_score: item.scores.momentum,
          weighted_score: item.weightedScore,
          provenance: { pipeline: "reviewed-edition", editorial_reviewed: true },
        }),
      });
      await rest("edition_story_placements", {
        method: "POST",
        body: JSON.stringify({ edition_id: edition.id, story_id: story.id, section_slug: item.category, rank: item.rank }),
      });
      for (const topic of item.topics) {
        const [savedTopic] = await rest("topics?on_conflict=slug&select=id", {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=representation",
          body: JSON.stringify({ name: decodeEntities(topic.name), slug: topic.slug }),
        });
        await rest("story_topics?on_conflict=story_id,topic_id", {
          method: "POST",
          prefer: "resolution=ignore-duplicates,return=minimal",
          body: JSON.stringify({ story_id: story.id, topic_id: savedTopic.id }),
        });
      }
    }
    return { id: edition.id, status: edition.status, editionDate: edition.edition_date, storyCount: report.selected.length };
  } catch (error) {
    await rest(`editions?id=eq.${edition.id}`, {
      method: "PATCH", prefer: "return=minimal",
      body: JSON.stringify({ status: "failed", failure_reason: error.message.slice(0, 1000) }),
    });
    throw error;
  }
}
