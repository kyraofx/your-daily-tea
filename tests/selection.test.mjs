import assert from "node:assert/strict";
import test from "node:test";
import { selectBalancedEdition } from "../scripts/newsroom/selection.mjs";

function candidate(category, sourceName, topic, weightedScore, publisherName) {
  return { category, sourceName, publisherName, weightedScore, topics: [{ slug: topic }] };
}

test("limits one source to two stories in a section", () => {
  const items = [
    candidate("usa", "Source A", "one", 100),
    candidate("usa", "Source A", "two", 99),
    candidate("usa", "Source A", "three", 98),
    candidate("usa", "Source B", "four", 97),
    candidate("usa", "Source C", "five", 96),
  ];
  const selected = selectBalancedEdition(items, ["usa"]);
  assert.equal(selected.length, 4);
  assert.equal(selected.filter((item) => item.sourceName === "Source A").length, 2);
});

test("counts desk-specific feeds as one publisher", () => {
  const categories = ["usa", "world", "sports"];
  const items = categories.flatMap((category, index) => [
    candidate(category, `Publisher — ${category}`, `${category}-one`, 100 - index, "Publisher"),
    candidate(category, `Publisher — ${category}`, `${category}-two`, 90 - index, "Publisher"),
    candidate(category, `Alternative ${category}`, `${category}-three`, 80, `Alternative ${category}`),
  ]);
  const selected = selectBalancedEdition(items, categories, { maxPerSourcePerEdition: 3 });
  assert.equal(selected.filter((item) => item.publisherName === "Publisher").length, 3);
});

test("limits one source across the full edition", () => {
  const categories = ["usa", "world", "sports", "gaming"];
  const items = categories.flatMap((category, categoryIndex) => [
    candidate(category, "Dominant", `${category}-one`, 100 - categoryIndex),
    candidate(category, "Dominant", `${category}-two`, 99 - categoryIndex),
    candidate(category, `Alternative ${category}`, `${category}-three`, 80),
  ]);
  const selected = selectBalancedEdition(items, categories, { maxPerSourcePerEdition: 3 });
  assert.equal(selected.filter((item) => item.sourceName === "Dominant").length, 3);
});
