import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CATEGORY_SLUGS } from "../scripts/newsroom/openai.mjs";

const sources = JSON.parse(await readFile(new URL("../scripts/newsroom/feed-sources.json", import.meta.url), "utf8"));

test("every section has at least two configured feed sources", () => {
  for (const category of CATEGORY_SLUGS) {
    const matching = sources.filter((source) => source.categories.includes(category));
    assert.ok(matching.length >= 2, `${category} has only ${matching.length} sources`);
  }
});

test("source registry has unique names and URLs", () => {
  assert.equal(new Set(sources.map((source) => source.name)).size, sources.length);
  assert.equal(new Set(sources.map((source) => source.url)).size, sources.length);
});
