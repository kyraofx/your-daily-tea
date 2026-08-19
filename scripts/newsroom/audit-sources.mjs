import { readFile } from "node:fs/promises";
import { CATEGORY_SLUGS } from "./openai.mjs";
import { parseFeed } from "./feeds.mjs";

const sources = JSON.parse(await readFile(new URL("./feed-sources.json", import.meta.url), "utf8"));
const live = process.argv.includes("--live");
const coverage = Object.fromEntries(CATEGORY_SLUGS.map((category) => [category, []]));
const problems = [];

for (const source of sources) {
  if (!source.name || !source.url || !Array.isArray(source.categories)) {
    problems.push(`Invalid source entry: ${JSON.stringify(source)}`);
    continue;
  }
  for (const category of source.categories) {
    if (!coverage[category]) problems.push(`${source.name}: unknown category ${category}`);
    else coverage[category].push(source.name);
  }
}

for (const [category, names] of Object.entries(coverage)) {
  if (names.length < 2) problems.push(`${category}: requires at least two configured sources`);
}

const health = [];
if (live) {
  const settled = await Promise.allSettled(sources.map(async (source) => {
    const response = await fetch(source.url, { headers: { "User-Agent": "YourDailyTea/0.1 source-audit" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = parseFeed(await response.text(), source);
    if (!items.length) throw new Error("no parseable items");
    return { name: source.name, status: "healthy", items: items.length };
  }));
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") health.push(result.value);
    else {
      const issue = `${sources[index].name}: ${result.reason?.message ?? result.reason}`;
      health.push({ name: sources[index].name, status: "failed", error: issue });
      problems.push(issue);
    }
  });
}

console.log(JSON.stringify({
  sources: sources.length,
  categories: Object.fromEntries(Object.entries(coverage).map(([category, names]) => [category, names.length])),
  live,
  healthy: health.filter((source) => source.status === "healthy").length,
  failed: health.filter((source) => source.status === "failed").length,
  problems,
}, null, 2));

if (problems.length) process.exitCode = 1;
