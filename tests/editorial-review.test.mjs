import assert from "node:assert/strict";
import test from "node:test";
import { applyEditorialDecisions, editorialReviewRequest, reviewEdition } from "../scripts/newsroom/editorial-review.mjs";

function story(url, category, score = 80) {
  return {
    canonicalUrl: url, category, headline: `Headline ${url}`, summary: "Summary",
    sourceName: "Source", publishedAt: "2026-09-21T08:00:00.000Z",
    weightedScore: score, topics: [{ slug: url.split("/").at(-1) }],
  };
}

test("editorial review requests one strict decision per story without tools", () => {
  const stories = [story("https://example.com/one", "usa"), story("https://example.com/two", "world")];
  const request = editorialReviewRequest({ stories });
  assert.equal(request.model, "gpt-5.6-luna");
  assert.equal(request.tools, undefined);
  assert.equal(request.text.format.strict, true);
  assert.equal(request.text.format.schema.properties.decisions.minItems, 2);
  assert.deepEqual(
    request.text.format.schema.properties.decisions.items.properties.storyId.enum,
    ["story-001", "story-002"],
  );
  assert.equal(request.text.format.schema.properties.decisions.items.properties.canonicalUrl, undefined);
  assert.match(request.input, /story-001/);
  assert.match(request.input, /Other Notable must not duplicate/);
});

test("editorial review returns no decisions when no stories were supplied", async () => {
  let called = false;
  const fakeFetch = async () => {
    called = true;
  };
  assert.deepEqual(await reviewEdition({ stories: [], apiKey: "test-key" }, fakeFetch), []);
  assert.equal(called, false);
});

test("applies remove and move decisions while preserving story data", () => {
  const first = story("https://example.com/one", "usa", 90);
  const second = story("https://example.com/two", "other-notable", 80);
  const selected = applyEditorialDecisions([first, second], [
    { canonicalUrl: first.canonicalUrl, action: "move", targetCategory: "world" },
    { canonicalUrl: second.canonicalUrl, action: "remove", targetCategory: null },
  ]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].category, "world");
  assert.equal(selected[0].headline, first.headline);
});

test("uses reviewed alternates to preserve the source section floor after a move", () => {
  const first = story("https://example.com/first", "usa", 90);
  const alternate = story("https://example.com/alternate", "usa", 80);
  const selected = applyEditorialDecisions([first, alternate], [
    { canonicalUrl: first.canonicalUrl, action: "move", targetCategory: "politics-policy" },
    { canonicalUrl: alternate.canonicalUrl, action: "keep", targetCategory: null },
  ]);
  assert.equal(selected.filter(({ category }) => category === "usa").length, 2);
  assert.equal(selected.filter(({ category }) => category === "politics-policy").length, 0);
});

test("does not let category moves erase an otherwise qualified section", () => {
  const first = story("https://example.com/first", "jobs-work", 90);
  const second = story("https://example.com/second", "jobs-work", 80);
  const third = story("https://example.com/third", "jobs-work", 70);
  const selected = applyEditorialDecisions([first, second, third], [
    { canonicalUrl: first.canonicalUrl, action: "move", targetCategory: "money-economy" },
    { canonicalUrl: second.canonicalUrl, action: "move", targetCategory: "money-economy" },
    { canonicalUrl: third.canonicalUrl, action: "move", targetCategory: "money-economy" },
  ]);
  assert.equal(selected.filter(({ category }) => category === "jobs-work").length, 2);
  assert.equal(selected.filter(({ category }) => category === "money-economy").length, 1);
});

test("still honors duplicate removals when a section becomes underfilled", () => {
  const first = { ...story("https://example.com/first", "life-society", 90), headline: "School district approves student housing" };
  const second = { ...story("https://example.com/second", "life-society", 80), headline: "School district approves student housing plan" };
  const selected = applyEditorialDecisions([first, second], [
    { canonicalUrl: first.canonicalUrl, action: "remove", reason: "duplicate-event", duplicateOf: second.canonicalUrl, targetCategory: null },
    { canonicalUrl: second.canonicalUrl, action: "keep", targetCategory: null },
  ]);
  assert.equal(selected.length, 1);
});

test("does not let an unsupported duplicate label erase specialist-approved coverage", () => {
  const first = { ...story("https://example.com/first", "sports", 90), headline: "Baseball team wins championship" };
  const second = { ...story("https://example.com/second", "sports", 80), headline: "Tennis player reaches tournament final" };
  const unrelated = { ...story("https://example.com/unrelated", "usa", 95), headline: "Congress passes transportation bill" };
  const selected = applyEditorialDecisions([first, second, unrelated], [
    { canonicalUrl: first.canonicalUrl, action: "remove", reason: "duplicate-event", duplicateOf: unrelated.canonicalUrl, targetCategory: null },
    { canonicalUrl: second.canonicalUrl, action: "remove", reason: "duplicate-event", duplicateOf: unrelated.canonicalUrl, targetCategory: null },
    { canonicalUrl: unrelated.canonicalUrl, action: "keep", reason: "keep", duplicateOf: null, targetCategory: null },
  ]);
  assert.equal(selected.filter(({ category }) => category === "sports").length, 2);
});

test("does not bind a weak generic headline overlap as a final duplicate", () => {
  const first = { ...story("https://example.com/first", "money-economy", 90), headline: "Federal Reserve cuts rates as economy slows" };
  const second = { ...story("https://example.com/second", "money-economy", 80), headline: "Federal Reserve holds rates as economy grows" };
  const selected = applyEditorialDecisions([first, second], [
    { canonicalUrl: first.canonicalUrl, action: "remove", reason: "duplicate-event", duplicateOf: second.canonicalUrl, targetCategory: null },
    { canonicalUrl: second.canonicalUrl, action: "keep", reason: "keep", duplicateOf: null, targetCategory: null },
  ]);
  assert.equal(selected.filter(({ category }) => category === "money-economy").length, 2);
});

test("places one copy of duplicate events in the section that reduces coverage deficits", () => {
  const usa = [1, 2, 3, 4].map((number) => story(`https://example.com/usa-${number}`, "usa", 100 - number));
  const sports = [1, 2].map((number) => story(`https://example.com/sports-${number}`, "sports", 90 - number));
  const selected = applyEditorialDecisions([...usa, ...sports], [
    ...usa.map((item) => ({ canonicalUrl: item.canonicalUrl, action: "keep", reason: "keep", targetCategory: null })),
    { canonicalUrl: sports[0].canonicalUrl, action: "remove", reason: "duplicate-event", duplicateOf: usa[0].canonicalUrl, targetCategory: null },
    { canonicalUrl: sports[1].canonicalUrl, action: "remove", reason: "duplicate-event", duplicateOf: usa[1].canonicalUrl, targetCategory: null },
  ]);
  assert.equal(selected.filter(({ category }) => category === "usa").length, 2);
  assert.equal(selected.filter(({ category }) => category === "sports").length, 2);
  assert.equal(new Set(selected.map(({ canonicalUrl }) => canonicalUrl)).size, selected.length);
});

test("uses a specialist-approved low-value alternate only to preserve the section floor", () => {
  const first = story("https://example.com/first", "life-society", 90);
  const second = story("https://example.com/second", "life-society", 80);
  const third = story("https://example.com/third", "life-society", 70);
  const selected = applyEditorialDecisions([first, second, third], [
    { canonicalUrl: first.canonicalUrl, action: "keep", reason: "keep", targetCategory: null },
    { canonicalUrl: second.canonicalUrl, action: "remove", reason: "low-value", targetCategory: null },
    { canonicalUrl: third.canonicalUrl, action: "remove", reason: "low-value", targetCategory: null },
  ]);
  assert.equal(selected.length, 2);
  assert.ok(selected.some(({ canonicalUrl }) => canonicalUrl === first.canonicalUrl));
  assert.ok(selected.some(({ canonicalUrl }) => canonicalUrl === second.canonicalUrl));
});

test("grounds editorial story IDs back to exact supplied URLs", async () => {
  const stories = [story("https://example.com/one", "usa"), story("https://example.com/two", "world")];
  const fakeFetch = async () => ({ ok: true, json: async () => ({
    output_text: JSON.stringify({ decisions: [
      { storyId: "story-001", action: "keep", targetCategory: null, reason: "keep", duplicateOf: null },
      { storyId: "story-002", action: "remove", targetCategory: null, reason: "duplicate-event", duplicateOf: "story-001" },
    ] }),
  }) });
  assert.deepEqual(await reviewEdition({ stories, apiKey: "test-key" }, fakeFetch), [
    { canonicalUrl: "https://example.com/one", action: "keep", targetCategory: null, reason: "keep", duplicateOf: null },
    { canonicalUrl: "https://example.com/two", action: "remove", targetCategory: null, reason: "duplicate-event", duplicateOf: "https://example.com/one" },
  ]);
});

test("rejects an editorial decision containing an unknown story ID", async () => {
  const stories = [story("https://example.com/one", "usa")];
  const fakeFetch = async () => ({ ok: true, json: async () => ({
    output_text: JSON.stringify({ decisions: [{
      storyId: "story-999", action: "keep", targetCategory: null,
      reason: "keep", duplicateOf: null,
    }] }),
  }) });
  await assert.rejects(reviewEdition({ stories, apiKey: "test-key" }, fakeFetch), /unknown story ID/);
});
