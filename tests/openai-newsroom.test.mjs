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
  assert.match(request.input, /Select two to eight worthwhile/);
  assert.match(request.input, /Never lower the standard or select filler/);
  assert.equal(request.tools, undefined);
  assert.match(request.input, /A feed headline/);
  assert.match(request.input, /candidate-001/);
  assert.equal(request.text.format.strict, true);
  assert.deepEqual(
    request.text.format.schema.properties.candidates.items.properties.candidateId.enum,
    ["candidate-001"],
  );
  assert.equal(request.text.format.schema.properties.candidates.items.properties.canonicalUrl, undefined);
});

test("evaluation parses a structured shortlist", async () => {
  const expected = [{
    candidateId: "candidate-001", summary: "Grounded summary", topics: ["One", "Two"],
    scores: { importance: 80, sourceQuality: 1 },
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
    summary: "Grounded summary", topics: ["One", "Two"], category: "usa",
    headline: "Grounded headline", canonicalUrl: "https://example.com/selected",
    sourceName: "Grounded Source — USA",
    publisherName: "Grounded Source",
    publishedAt: "2026-08-19T02:00:00.000Z", scores: { importance: 80, sourceQuality: 92 },
  }]);
});

test("evaluation returns no selections when no candidates were supplied", async () => {
  let called = false;
  const fakeFetch = async () => {
    called = true;
  };
  assert.deepEqual(await evaluateCandidates({
    category: "usa", candidates: [], apiKey: "test-key",
  }, fakeFetch), []);
  assert.equal(called, false);
});

test("evaluation rejects candidate IDs that were not supplied by a feed", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ output_text: JSON.stringify({ candidates: [{
      candidateId: "candidate-999", scores: { sourceQuality: 99 },
    }] }) }),
  });
  await assert.rejects(evaluateCandidates({
    category: "usa", candidates: [{ canonicalUrl: "https://example.com/real-story" }], apiKey: "test-key",
  }, fakeFetch), /unknown candidate ID/);
});

test("evaluation grounds a candidate ID back to the exact supplied feed URL", async () => {
  const suppliedUrl = "https://www.nytimes.com/2026/08/26/us/tif-chicago-study-downtown.html?partner=rss&emc=rss";
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ output_text: JSON.stringify({ candidates: [{
      candidateId: "candidate-001",
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

test("evaluation selects the intended supplied candidate by opaque ID", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ output_text: JSON.stringify({ candidates: [{
      candidateId: "candidate-002",
      scores: { sourceQuality: 1 },
    }] }) }),
  });
  const [result] = await evaluateCandidates({
    category: "politics-policy",
    apiKey: "test-key",
    candidates: [
      { canonicalUrl: "https://example.com/first", headline: "First", sourceName: "Example", credibilityScore: 88 },
      { canonicalUrl: "https://example.com/second", headline: "Second", sourceName: "Example", credibilityScore: 92 },
    ],
  }, fakeFetch);
  assert.equal(result.canonicalUrl, "https://example.com/second");
  assert.equal(result.headline, "Second");
  assert.equal(result.scores.sourceQuality, 92);
});

test("evaluation rejects duplicate candidate IDs", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ output_text: JSON.stringify({ candidates: [
      { candidateId: "candidate-001", scores: { sourceQuality: 99 } },
      { candidateId: "candidate-001", scores: { sourceQuality: 99 } },
    ] }) }),
  });
  await assert.rejects(evaluateCandidates({
    category: "politics-policy",
    apiKey: "test-key",
    candidates: [{
      canonicalUrl: "https://example.com/real-story",
    }],
  }, fakeFetch), /duplicate candidate ID/);
});
