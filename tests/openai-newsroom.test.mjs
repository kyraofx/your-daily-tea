import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCandidates, evaluationRequest, retrieveCategory, retrievalRequest } from "../scripts/newsroom/openai.mjs";

const options = {
  category: "usa",
  coverageStartsAt: "2026-08-18T13:00:00.000Z",
  coverageEndsAt: "2026-08-19T12:59:59.999Z",
  model: "gpt-5.6-luna",
};

test("retrieval requests web search and strict structured output", () => {
  const request = retrievalRequest(options);
  assert.deepEqual(request.tools, [{ type: "web_search", search_context_size: "low" }]);
  assert.equal(request.tool_choice, "required");
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.deepEqual(request.reasoning, { effort: "none" });
  assert.match(request.input, /USA|United States/i);
  assert.match(request.input, /2026-08-18T13:00:00/);
});

test("retrieval parses a structured response", async () => {
  const expected = [{ category: "usa", headline: "Test" }];
  const fakeFetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.model, "gpt-5.6-luna");
    return { ok: true, json: async () => ({ output_text: JSON.stringify({ candidates: expected }) }) };
  };
  assert.deepEqual(await retrieveCategory({ ...options, apiKey: "test-key" }, fakeFetch), expected);
});

test("retrieval reports quota failures without retrying", async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: { code: "insufficient_quota", message: "Billing required" } }),
  });
  await assert.rejects(
    retrieveCategory({ ...options, apiKey: "test-key" }, fakeFetch),
    /insufficient_quota.*Billing required/,
  );
});

test("evaluation uses supplied candidates without a web-search tool", () => {
  const request = evaluationRequest({
    category: "usa",
    candidates: [{
      headline: "A feed headline", canonicalUrl: "https://example.com/story",
      sourceName: "Example", publishedAt: "2026-08-19T01:00:00.000Z", sourceSummary: "Feed summary",
    }],
  });
  assert.equal(request.model, "gpt-5.6-luna");
  assert.equal(request.tools, undefined);
  assert.match(request.input, /A feed headline/);
  assert.equal(request.text.format.strict, true);
});

test("evaluation parses a structured shortlist", async () => {
  const expected = [{
    category: "usa", headline: "Selected", canonicalUrl: "https://example.com/selected",
    sourceName: "Model Source", publishedAt: "2026-08-19T01:00:00.000Z",
    scores: { sourceQuality: 1 },
  }];
  const supplied = [{
    headline: "Grounded headline", canonicalUrl: "https://example.com/selected",
    sourceName: "Grounded Source — USA", publisherName: "Grounded Source",
    publishedAt: "2026-08-19T02:00:00.000Z", credibilityScore: 92,
  }];
  const fakeFetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.tools, undefined);
    return { ok: true, json: async () => ({ output_text: JSON.stringify({ candidates: expected }) }) };
  };
  assert.deepEqual(await evaluateCandidates({
    category: "usa", candidates: supplied, apiKey: "test-key",
  }, fakeFetch), [{
    ...expected[0], headline: "Grounded headline", sourceName: "Grounded Source — USA",
    publisherName: "Grounded Source",
    publishedAt: "2026-08-19T02:00:00.000Z", scores: { sourceQuality: 92 },
  }]);
});

test("evaluation rejects URLs that were not supplied by a feed", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ output_text: JSON.stringify({ candidates: [{
      canonicalUrl: "https://invented.example/story", scores: { sourceQuality: 99 },
    }] }) }),
  });
  await assert.rejects(evaluateCandidates({
    category: "usa", candidates: [], apiKey: "test-key",
  }, fakeFetch), /unknown candidate URL/);
});

test("evaluation grounds equivalent canonical URLs back to the supplied feed URL", async () => {
  const suppliedUrl = "https://www.nytimes.com/2026/08/26/us/tif-chicago-study-downtown.html?partner=rss&emc=rss";
  const evaluatedUrl = "https://nytimes.com/2026/08/26/us/tif-chicago-study-downtown.html";
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ output_text: JSON.stringify({ candidates: [{
      canonicalUrl: evaluatedUrl,
      headline: "Model headline",
      sourceName: "Model source",
      publishedAt: "2026-08-27T01:00:00.000Z",
      scores: { sourceQuality: 1 },
    }] }) }),
  });
  const [result] = await evaluateCandidates({
    category: "usa",
    apiKey: "test-key",
    candidates: [{
      canonicalUrl: suppliedUrl,
      headline: "Grounded headline",
      sourceName: "The New York Times",
      publishedAt: "2026-08-27T02:00:00.000Z",
      credibilityScore: 92,
    }],
  }, fakeFetch);
  assert.equal(result.canonicalUrl, suppliedUrl);
  assert.equal(result.headline, "Grounded headline");
  assert.equal(result.sourceName, "The New York Times");
  assert.equal(result.publishedAt, "2026-08-27T02:00:00.000Z");
  assert.equal(result.scores.sourceQuality, 92);
});

test("evaluation grounds an NPR slug variation by stable story ID", async () => {
  const suppliedUrl = "https://www.npr.org/2026/09/06/nx-s1-5959657/us-envoys-witkoff-kushner-talks-in-kyiv-putin-moscow";
  const evaluatedUrl = "https://www.npr.org/2026/09/06/nx-s1-5959657/us-envoys-witkoff-kushner-talks-kyiv-putin-moscow";
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ output_text: JSON.stringify({ candidates: [{
      canonicalUrl: evaluatedUrl,
      headline: "Model headline",
      sourceName: "Model source",
      publishedAt: "2026-09-06T12:00:00.000Z",
      scores: { sourceQuality: 1 },
    }] }) }),
  });
  const [result] = await evaluateCandidates({
    category: "politics-policy",
    apiKey: "test-key",
    candidates: [{
      canonicalUrl: suppliedUrl,
      headline: "Grounded NPR headline",
      sourceName: "NPR",
      publishedAt: "2026-09-06T11:00:00.000Z",
      credibilityScore: 92,
    }],
  }, fakeFetch);
  assert.equal(result.canonicalUrl, suppliedUrl);
  assert.equal(result.headline, "Grounded NPR headline");
  assert.equal(result.sourceName, "NPR");
  assert.equal(result.publishedAt, "2026-09-06T11:00:00.000Z");
  assert.equal(result.scores.sourceQuality, 92);
});

test("evaluation rejects an NPR slug variation with a different story ID", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ output_text: JSON.stringify({ candidates: [{
      canonicalUrl: "https://www.npr.org/2026/09/06/nx-s1-9999999/invented-story",
      scores: { sourceQuality: 99 },
    }] }) }),
  });
  await assert.rejects(evaluateCandidates({
    category: "politics-policy",
    apiKey: "test-key",
    candidates: [{
      canonicalUrl: "https://www.npr.org/2026/09/06/nx-s1-5959657/real-story",
    }],
  }, fakeFetch), /unknown candidate URL/);
});

test("evaluation rejects an ambiguous NPR story ID fallback", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ output_text: JSON.stringify({ candidates: [{
      canonicalUrl: "https://www.npr.org/2026/09/06/nx-s1-5959657/model-slug",
      scores: { sourceQuality: 99 },
    }] }) }),
  });
  await assert.rejects(evaluateCandidates({
    category: "politics-policy",
    apiKey: "test-key",
    candidates: [
      { canonicalUrl: "https://www.npr.org/2026/09/06/nx-s1-5959657/feed-slug-one" },
      { canonicalUrl: "https://www.npr.org/2026/09/06/nx-s1-5959657/feed-slug-two" },
    ],
  }, fakeFetch), /ambiguous NPR story URL/);
});
