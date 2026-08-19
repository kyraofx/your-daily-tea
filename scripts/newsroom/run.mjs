import { readFile } from "node:fs/promises";
import process from "node:process";

const WEIGHTS = {
  importance: 0.25,
  interestingness: 0.2,
  relevance: 0.2,
  newness: 0.15,
  sourceQuality: 0.15,
  momentum: 0.05,
};

const CATEGORIES = new Set([
  "usa", "california", "world", "tech-ai", "science-planet",
  "health-wellness", "money-economy", "politics-policy", "jobs-work",
  "sports", "internet-trends", "gaming", "life-society", "pop-culture",
  "other-notable",
]);

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizedUrl(value) {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  }
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  return url.toString();
}

function score(candidate) {
  let total = 0;
  for (const [dimension, weight] of Object.entries(WEIGHTS)) {
    const value = Number(candidate.scores?.[dimension]);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`${candidate.headline}: ${dimension} must be between 0 and 100.`);
    }
    total += value * weight;
  }
  return Math.round(total * 100) / 100;
}

function pacificSixAm(dateString) {
  const probe = new Date(`${dateString}T12:00:00Z`);
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "longOffset",
  }).formatToParts(probe).find((item) => item.type === "timeZoneName")?.value;
  const match = part?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) throw new Error("Could not resolve the Pacific timezone offset.");
  const sign = match[1] === "+" ? 1 : -1;
  const offsetMinutes = sign * (Number(match[2]) * 60 + Number(match[3]));
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 6) - offsetMinutes * 60_000);
}

function coverageWindow(editionDate) {
  const endBoundary = pacificSixAm(editionDate);
  const previous = new Date(`${editionDate}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const start = pacificSixAm(previous.toISOString().slice(0, 10));
  return { start, end: new Date(endBoundary.getTime() - 1) };
}

function prepare(candidates, editionDate) {
  const window = coverageWindow(editionDate);
  const seenUrls = new Set();
  const seenHeadlines = new Set();
  const rejected = [];
  const accepted = [];

  for (const raw of candidates) {
    try {
      if (!CATEGORIES.has(raw.category)) throw new Error("unknown category");
      const publishedAt = new Date(raw.publishedAt);
      if (Number.isNaN(publishedAt.valueOf())) throw new Error("invalid publication time");
      if (publishedAt < window.start || publishedAt > window.end) throw new Error("outside coverage window");
      const canonicalUrl = normalizedUrl(raw.canonicalUrl);
      const headlineKey = raw.headline.toLowerCase().replace(/\W+/g, " ").trim();
      if (seenUrls.has(canonicalUrl) || seenHeadlines.has(headlineKey)) throw new Error("duplicate candidate");
      const weightedScore = score(raw);
      if (weightedScore < 60) throw new Error("below calibration threshold");
      if (!raw.summary?.trim()) throw new Error("summary is required until AI generation is enabled");
      if (!Array.isArray(raw.topics) || raw.topics.length < 2 || raw.topics.length > 5) {
        throw new Error("two to five topics are required");
      }
      seenUrls.add(canonicalUrl);
      seenHeadlines.add(headlineKey);
      accepted.push({
        ...raw,
        canonicalUrl,
        publishedAt: publishedAt.toISOString(),
        weightedScore,
        topics: raw.topics.map((name) => ({ name, slug: slugify(name) })),
      });
    } catch (error) {
      rejected.push({ headline: raw.headline ?? "Untitled", reason: error.message });
    }
  }

  const selected = [];
  for (const category of CATEGORIES) {
    selected.push(...accepted.filter((item) => item.category === category)
      .sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 4)
      .map((item, index) => ({ ...item, rank: index + 1 })));
  }
  return {
    editionDate,
    coverageStartsAt: window.start.toISOString(),
    coverageEndsAt: window.end.toISOString(),
    selected,
    rejected,
  };
}

async function localEnvironment() {
  try {
    const text = await readFile(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {}
}

async function rest(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Saving requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: options.prefer ?? "return=representation",
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function saveDraft(report) {
  const categories = await rest("categories?select=id,slug");
  const categoryIds = new Map(categories.map((item) => [item.slug, item.id]));
  const [edition] = await rest("editions?select=id", {
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
        body: JSON.stringify({ name: item.sourceName, domain }),
      });
      const [story] = await rest("stories?select=id", {
        method: "POST",
        body: JSON.stringify({
          category_id: categoryIds.get(item.category), source_id: source.id,
          headline: item.headline, summary: item.summary,
          canonical_url: item.canonicalUrl, published_at: item.publishedAt,
          importance_score: item.scores.importance,
          interestingness_score: item.scores.interestingness,
          relevance_score: item.scores.relevance,
          newness_score: item.scores.newness,
          source_quality_score: item.scores.sourceQuality,
          momentum_score: item.scores.momentum,
          weighted_score: item.weightedScore,
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
          body: JSON.stringify(topic),
        });
        await rest("story_topics?on_conflict=story_id,topic_id", {
          method: "POST",
          prefer: "resolution=ignore-duplicates,return=minimal",
          body: JSON.stringify({ story_id: story.id, topic_id: savedTopic.id }),
        });
      }
    }
    return edition.id;
  } catch (error) {
    await rest(`editions?id=eq.${edition.id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ status: "failed", failure_reason: error.message }),
    });
    throw error;
  }
}

await localEnvironment();
const inputPath = argument("--input");
if (!inputPath) throw new Error("Use --input <candidate-file.json>.");
const editionDate = argument("--date", new Date().toISOString().slice(0, 10));
const candidates = JSON.parse(await readFile(inputPath, "utf8"));
const report = prepare(candidates, editionDate);

if (process.argv.includes("--save")) {
  report.editionId = await saveDraft(report);
  report.savedAs = "draft";
}
console.log(JSON.stringify(report, null, 2));
