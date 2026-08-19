import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fetchPublishedArchive } from "./archive.mjs";
import { deduplicateCandidates } from "./dedupe.mjs";

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
const inputs = argument("--input")?.split(",").filter(Boolean);
if (!inputs?.length) throw new Error("--input is required and may contain comma-separated JSON files.");
const output = argument("--output", "work/deduplicated-candidates.json");
const reportPath = argument("--report", output.replace(/\.json$/, "-report.json"));
const candidates = (await Promise.all(inputs.map(async (file) => JSON.parse(await readFile(file, "utf8"))))).flat();
const days = Number(argument("--archive-days", "30"));
const since = new Date(Date.now() - days * 86_400_000).toISOString();
const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const archive = await fetchPublishedArchive({ supabaseUrl: process.env.SUPABASE_URL, apiKey, since });
const result = deduplicateCandidates(candidates, archive);
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(output, `${JSON.stringify(result.candidates, null, 2)}\n`, { mode: 0o600 });
await writeFile(reportPath, `${JSON.stringify(result.rejected, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({
  inputCandidates: candidates.length,
  archiveStoriesCompared: archive.length,
  keptCandidates: result.candidates.length,
  rejectedCandidates: result.rejected.length,
  output,
  report: reportPath,
}, null, 2));
