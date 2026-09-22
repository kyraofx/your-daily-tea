import assert from "node:assert/strict";
import test from "node:test";
import { selectBalancedEdition } from "../scripts/newsroom/selection.mjs";

function candidate(category, sourceName, topic, weightedScore, publisherName) {
  return { category, sourceName, publisherName, weightedScore, canonicalUrl: `https://example.com/${category}/${topic}`, topics: [{ slug: topic }] };
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

test("places one canonical story only once across the edition", () => {
  const shared = "https://example.com/shared-story";
  const items = [
    { ...candidate("usa", "Shared", "shared-usa", 100), canonicalUrl: shared },
    candidate("usa", "USA Alternative", "usa-alt", 90),
    { ...candidate("world", "Shared", "shared-world", 99), canonicalUrl: shared },
    candidate("world", "World Alternative A", "world-alt-a", 89),
    candidate("world", "World Alternative B", "world-alt-b", 88),
  ];
  const selected = selectBalancedEdition(items, ["usa", "world"], { maxPerCategory: 2 });
  assert.equal(selected.filter((item) => item.canonicalUrl === shared).length, 1);
  assert.equal(selected.filter((item) => item.category === "usa").length, 2);
  assert.equal(selected.filter((item) => item.category === "world").length, 2);
});

test("allows a repeated primary topic only to reach the section floor", () => {
  const selected = selectBalancedEdition([
    { ...candidate("jobs-work", "Source A", "ai-and-work", 100), canonicalUrl: "https://example.com/jobs/one" },
    { ...candidate("jobs-work", "Source B", "ai-and-work", 99), canonicalUrl: "https://example.com/jobs/two" },
    { ...candidate("jobs-work", "Source C", "ai-and-work", 98), canonicalUrl: "https://example.com/jobs/three" },
  ], ["jobs-work"], { maxPerCategory: 4, minimumPerCategory: 2 });
  assert.equal(selected.length, 2);
  assert.equal(new Set(selected.map((item) => item.canonicalUrl)).size, 2);
});

test("gives a partially fillable scarce section priority over broad desks", () => {
  const selected = selectBalancedEdition([
    candidate("early", "Shared — Early", "early-shared", 100, "Shared"),
    candidate("early", "Alternative A", "early-alt-one", 90, "Alternative A"),
    candidate("early", "Alternative B", "early-alt-two", 80, "Alternative B"),
    candidate("late", "Shared — Late", "late-only", 95, "Shared"),
  ], ["early", "late"], {
    maxPerCategory: 2,
    minimumPerCategory: 2,
    maxPerSourcePerEdition: 1,
  });
  assert.equal(selected.filter((item) => item.category === "late").length, 1);
  assert.equal(selected.filter((item) => item.category === "early").length, 2);
});

test("reserves floor capacity for sections with fewer available publishers", () => {
  const selected = selectBalancedEdition([
    candidate("broad", "Shared A — Broad", "broad-a", 100, "Shared A"),
    candidate("broad", "Shared B — Broad", "broad-b", 99, "Shared B"),
    candidate("broad", "Broad Alternative", "broad-alt", 80, "Broad Alternative"),
    candidate("sports", "Shared A — Sports", "sports-a-1", 95, "Shared A"),
    candidate("sports", "Shared A — Sports", "sports-a-2", 94, "Shared A"),
    candidate("sports", "Shared B — Sports", "sports-b-1", 93, "Shared B"),
    candidate("sports", "Shared B — Sports", "sports-b-2", 92, "Shared B"),
  ], ["broad", "sports"], {
    maxPerCategory: 2,
    minimumPerCategory: 2,
    maxPerSourcePerEdition: 1,
  });
  assert.equal(selected.filter((item) => item.category === "sports").length, 2);
  assert.equal(selected.filter((item) => item.category === "broad").length, 1);
});

test("backtracks publisher choices to find a complete section-floor assignment", () => {
  const selected = selectBalancedEdition([
    candidate("first", "Shared A — First", "first-a", 100, "Shared A"),
    candidate("first", "Shared B — First", "first-b", 90, "Shared B"),
    candidate("second", "Shared A — Second", "second-a", 100, "Shared A"),
    candidate("second", "Shared C — Second", "second-c", 90, "Shared C"),
    candidate("third", "Shared B — Third", "third-b", 100, "Shared B"),
    candidate("third", "Shared C — Third", "third-c", 90, "Shared C"),
  ], ["first", "second", "third"], {
    maxPerCategory: 1,
    minimumPerCategory: 1,
    maxPerSourcePerEdition: 1,
  });
  assert.equal(selected.filter((item) => item.category === "first").length, 1);
  assert.equal(selected.filter((item) => item.category === "second").length, 1);
  assert.equal(selected.filter((item) => item.category === "third").length, 1);
  assert.equal(new Set(selected.map((item) => item.publisherName)).size, 3);
});
