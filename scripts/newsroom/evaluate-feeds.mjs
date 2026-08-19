import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { evaluateCandidates } from "./openai.mjs";

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
if (!input) throw new Error("--input is required.");
const category = argument("--category", "usa");
const output = argument("--output", input.replace(/\.json$/, "-evaluated.json"));
const candidates = JSON.parse(await readFile(input, "utf8"));
const evaluated = await evaluateCandidates({
  category,
  candidates,
  model: process.env.OPENAI_NEWSROOM_MODEL ?? "gpt-5.6-luna",
});
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(output, `${JSON.stringify(evaluated, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ category, inputCandidates: candidates.length, selectedCandidates: evaluated.length, output }, null, 2));
