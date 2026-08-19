import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { applyEditorialDecisions, reviewEdition } from "./editorial-review.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function loadEnvironment() {
  for (const file of [".env.local", `${homedir()}/.config/your-daily-tea/secrets.env`]) {
    try {
      for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
      }
    } catch {
      // Each local environment file is optional.
    }
  }
}

await loadEnvironment();
const input = argument("--input");
if (!input) throw new Error("--input review report is required.");
const output = resolve(argument("--output", input.replace(/\.json$/, "-reviewed.json")));
const decisionsPath = resolve(argument("--decisions", input.replace(/\.json$/, "-decisions.json")));
const report = JSON.parse(await readFile(input, "utf8"));
const decisions = await reviewEdition({
  stories: report.selected,
  model: process.env.OPENAI_NEWSROOM_MODEL ?? "gpt-5.6-luna",
});
const selected = applyEditorialDecisions(report.selected, decisions);
const reviewed = {
  ...report,
  selected,
  editorialReview: {
    inputStories: report.selected.length,
    finalStories: selected.length,
    kept: decisions.filter((decision) => decision.action === "keep").length,
    moved: decisions.filter((decision) => decision.action === "move").length,
    removed: decisions.filter((decision) => decision.action === "remove").length,
  },
};
await mkdir(dirname(output), { recursive: true });
await writeFile(decisionsPath, `${JSON.stringify(decisions, null, 2)}\n`, { mode: 0o600 });
await writeFile(output, `${JSON.stringify(reviewed, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ output, decisions: decisionsPath, ...reviewed.editorialReview }, null, 2));
