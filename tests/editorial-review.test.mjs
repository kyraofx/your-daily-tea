import assert from "node:assert/strict";
import test from "node:test";
import { applyEditorialDecisions, editorialReviewRequest, reviewEdition } from "../scripts/newsroom/editorial-review.mjs";

function story(url, category, score = 80) {
  return {
    canonicalUrl: url, category, headline: `Headline ${url}`, summary: "Summary",
    sourceName: "Source", weightedScore: score, topics: [{ slug: url.split("/").at(-1) }],
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
