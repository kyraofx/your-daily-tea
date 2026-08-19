import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { CATEGORY_SLUGS, retrieveCategory } from "./openai.mjs";

async function loadEnvironment() {
  const { readFile } = await import("node:fs/promises");
  for (const file of [".env.local", `${homedir()}/.config/your-daily-tea/secrets.env`]) {
    try {
      for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
      }
    } catch {}
  }
}

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

await loadEnvironment();
const editionDate = argument("--date", new Date().toISOString().slice(0, 10));
const oneCategory = argument("--category");
if (oneCategory && !CATEGORY_SLUGS.includes(oneCategory)) throw new Error(`Unknown category: ${oneCategory}`);
const categories = oneCategory ? [oneCategory] : CATEGORY_SLUGS;
const window = windowFor(editionDate);
const candidates = [];

for (const category of categories) {
  process.stderr.write(`Retrieving ${category}...\n`);
  candidates.push(...await retrieveCategory({
    category,
    ...window,
    model: process.env.OPENAI_NEWSROOM_MODEL ?? "gpt-5.6-luna",
  }));
}

const output = argument("--output", `work/candidates-${editionDate}.json`);
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(output, `${JSON.stringify(candidates, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ editionDate, ...window, categories: categories.length, candidates: candidates.length, output }, null, 2));
