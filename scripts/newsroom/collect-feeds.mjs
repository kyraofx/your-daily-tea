import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { collectFeeds } from "./feeds.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function pacificSixAm(dateString) {
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", timeZoneName: "longOffset",
  }).formatToParts(new Date(`${dateString}T12:00:00Z`)).find((part) => part.type === "timeZoneName")?.value;
  const match = zone?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) throw new Error("Could not resolve Pacific time.");
  const offset = (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]));
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 6) - offset * 60_000);
}

function windowFor(editionDate) {
  const boundary = pacificSixAm(editionDate);
  const prior = new Date(`${editionDate}T12:00:00Z`);
  prior.setUTCDate(prior.getUTCDate() - 1);
  return {
    coverageStartsAt: pacificSixAm(prior.toISOString().slice(0, 10)).toISOString(),
    coverageEndsAt: new Date(boundary.getTime() - 1).toISOString(),
  };
}

const editionDate = argument("--date", new Date().toISOString().slice(0, 10));
const category = argument("--category", "usa");
const output = argument("--output", `work/feed-candidates-${category}-${editionDate}.json`);
const sources = JSON.parse(await readFile(new URL("./feed-sources.json", import.meta.url), "utf8"));
const window = windowFor(editionDate);
const result = await collectFeeds({ sources, category, ...window });
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(output, `${JSON.stringify(result.candidates, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ editionDate, category, ...window, ...result, candidates: result.candidates.length, output }, (key, value) => key === "candidates" && Array.isArray(value) ? value.length : value, 2));
