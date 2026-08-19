import assert from "node:assert/strict";
import test from "node:test";
import { retrieveCategory, retrievalRequest } from "../scripts/newsroom/openai.mjs";

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
