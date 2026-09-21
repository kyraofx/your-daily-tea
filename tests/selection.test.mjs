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

test("reserves two stories for a scarce later section before filling earlier sections", () => {
  const items = [
    candidate("early", "Shared — Early", "early-shared-one", 100, "Shared"),
    candidate("early", "Shared — Early", "early-shared-two", 99, "Shared"),
    candidate("early", "Alternative A", "early-alt-one", 80, "Alternative A"),
    candidate("early", "Alternative B", "early-alt-two", 79, "Alternative B"),
    candidate("late", "Shared — Late", "late-one", 90, "Shared"),
    candidate("late", "Shared — Late", "late-two", 89, "Shared"),
  ];
  const selected = selectBalancedEdition(items, ["early", "late"], {
    maxPerCategory: 2,
    minimumPerCategory: 2,
    maxPerSourcePerEdition: 2,
  });
  assert.equal(selected.filter((item) => item.category === "early").length, 2);
  assert.equal(selected.filter((item) => item.category === "late").length, 2);
  assert.equal(selected.filter((item) => item.publisherName === "Shared").length, 2);
});

test("does not invent filler when a section has fewer than two eligible stories", () => {
  const selected = selectBalancedEdition([
    candidate("sports", "Source A", "only-topic", 90),
  ], ["sports"]);
  assert.equal(selected.length, 1);
});
