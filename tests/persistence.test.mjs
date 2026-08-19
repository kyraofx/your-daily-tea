import assert from "node:assert/strict";
import test from "node:test";
import { decodeEntities, publishReviewedEdition, saveReviewedDraft, validateAutomaticPublication } from "../scripts/newsroom/persistence.mjs";

const report = {
  editionDate: "2026-08-18", coverageStartsAt: "2026-08-17T13:00:00Z", coverageEndsAt: "2026-08-18T12:59:59Z",
  editorialReview: { finalStories: 1 },
  selected: [{
    category: "usa", rank: 1, headline: "California&#8217;s test", summary: "A &amp; B", canonicalUrl: "https://example.com/story",
    sourceName: "Example", publishedAt: "2026-08-18T01:00:00Z", weightedScore: 80,
    scores: { importance: 80, interestingness: 80, relevance: 80, newness: 80, sourceQuality: 90, momentum: 60 },
    topics: [{ name: "public policy", slug: "public-policy" }, { name: "USA", slug: "usa" }],
  }],
};

test("decodeEntities handles named and numeric HTML entities", () => {
  assert.equal(decodeEntities("A &amp; B &#8217; &#x2014;"), "A & B ’ —");
});

test("saveReviewedDraft creates only a draft and persists reviewed stories", async () => {
  const calls = [];
  const rest = async (path, options = {}) => {
    calls.push({ path, options });
    if (path.startsWith("editions?edition_date")) return [];
    if (path === "categories?select=id,slug") return [{ id: "category-1", slug: "usa" }];
    if (path.startsWith("editions?select")) return [{ id: "edition-1", status: "draft", edition_date: "2026-08-18" }];
    if (path.startsWith("sources?")) return [{ id: "source-1" }];
    if (path.startsWith("stories?")) return [{ id: "story-1" }];
    if (path.startsWith("topics?")) return [{ id: "topic-1" }];
    return null;
  };
  const result = await saveReviewedDraft(report, rest);
  assert.deepEqual(result, { id: "edition-1", status: "draft", editionDate: "2026-08-18", storyCount: 1 });
  const editionBody = JSON.parse(calls.find((call) => call.path.startsWith("editions?select")).options.body);
  assert.equal(editionBody.status, "draft");
  assert.equal(calls.some((call) => call.options.body?.includes('"status":"approved"') || call.options.body?.includes('"status":"published"')), false);
  const storyBody = JSON.parse(calls.find((call) => call.path.startsWith("stories?")).options.body);
  assert.equal(storyBody.headline, "California’s test");
  assert.equal(storyBody.summary, "A & B");
});

test("saveReviewedDraft refuses to overwrite an existing edition", async () => {
  await assert.rejects(
    saveReviewedDraft(report, async () => [{ id: "existing", status: "draft" }]),
    /refusing to overwrite/,
  );
});

test("automatic publication holds a thin edition", () => {
  assert.throws(() => validateAutomaticPublication(report), /below the minimum/);
});

test("automatic publication advances a reviewed edition through both guarded states", async () => {
  const fullReport = {
    ...report,
    selected: Array.from({ length: 20 }, (_, index) => ({
      ...report.selected[0],
      canonicalUrl: `https://example.com/story-${index}`,
      category: index < 10 ? "usa" : "california",
      rank: (index % 10) + 1,
    })),
  };
  const calls = [];
  const rest = async (path, options = {}) => {
    calls.push({ path, options });
    if (path.startsWith("editions?edition_date")) return [];
    if (path === "categories?select=id,slug") return [{ id: "category-1", slug: "usa" }, { id: "category-2", slug: "california" }];
    if (path.startsWith("editions?select")) return [{ id: "edition-1", status: "draft", edition_date: "2026-08-18" }];
    if (path.includes("status=eq.draft")) return [{ id: "edition-1", status: "approved", edition_date: "2026-08-18" }];
    if (path.includes("status=eq.approved")) return [{ id: "edition-1", status: "published", edition_date: "2026-08-18", published_at: new Date().toISOString() }];
    if (path.startsWith("edition_story_placements?")) return fullReport.selected.map((_, index) => ({ story_id: `story-${index}` }));
    if (path.startsWith("sources?")) return [{ id: "source-1" }];
    if (path.startsWith("stories?")) return [{ id: `story-${calls.length}` }];
    if (path.startsWith("topics?")) return [{ id: "topic-1" }];
    return null;
  };
  const result = await publishReviewedEdition(fullReport, rest, { minimumStories: 20, minimumSections: 2 });
  assert.equal(result.status, "published");
  assert.equal(calls.some((call) => call.options.body?.includes('"status":"approved"')), true);
  assert.equal(calls.some((call) => call.options.body?.includes('"status":"published"')), true);
});
