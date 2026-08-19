import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import process from "node:process";
import { fetchPublishedArchive } from "./archive.mjs";
import { deduplicateCandidates } from "./dedupe.mjs";
import { collectFeeds } from "./feeds.mjs";
import { CATEGORY_SLUGS, evaluateCandidates } from "./openai.mjs";
import { applyEditorialDecisions, reviewEdition } from "./editorial-review.mjs";
import { coverageWindow } from "./time.mjs";

const execFileAsync = promisify(execFile);

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
    } catch {}
  }
}

await loadEnvironment();
const editionDate = argument("--date", new Date().toISOString().slice(0, 10));
const outputDirectory = resolve(argument("--output-dir", `work/edition-${editionDate}`));
const categoryDirectory = resolve(outputDirectory, "categories");
const resume = process.argv.includes("--resume");
await mkdir(categoryDirectory, { recursive: true });

const sources = JSON.parse(await readFile(new URL("./feed-sources.json", import.meta.url), "utf8"));
const window = coverageWindow(editionDate);
const since = new Date(Date.parse(window.coverageStartsAt) - 30 * 86_400_000).toISOString();
const archive = await fetchPublishedArchive({
  supabaseUrl: process.env.SUPABASE_URL,
  apiKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_SECRET_KEY,
  since,
});
const evaluated = [];
const categoryStats = [];

for (const [index, category] of CATEGORY_SLUGS.entries()) {
  const checkpoint = resolve(categoryDirectory, `${category}.json`);
  if (resume) {
    try {
      const saved = JSON.parse(await readFile(checkpoint, "utf8"));
      evaluated.push(...saved);
      categoryStats.push({ category, evaluated: saved.length, resumed: true });
      process.stderr.write(`[${index + 1}/15] ${category}: resumed ${saved.length}\n`);
      continue;
    } catch {}
  }
  process.stderr.write(`[${index + 1}/15] ${category}: collecting feeds\n`);
  const feedResult = await collectFeeds({ sources, category, ...window });
  const discovery = deduplicateCandidates(feedResult.candidates, archive);
  process.stderr.write(`[${index + 1}/15] ${category}: evaluating ${discovery.candidates.length} candidates with Luna\n`);
  const selected = await evaluateCandidates({
    category,
    candidates: discovery.candidates,
    model: process.env.OPENAI_NEWSROOM_MODEL ?? "gpt-5.6-luna",
  });
  await writeFile(checkpoint, `${JSON.stringify(selected, null, 2)}\n`, { mode: 0o600 });
  evaluated.push(...selected);
  categoryStats.push({
    category,
    feeds: feedResult.sourcesChecked,
    discovered: feedResult.candidates.length,
    preEvaluationUnique: discovery.candidates.length,
    evaluated: selected.length,
    feedErrors: feedResult.errors,
  });
  process.stderr.write(`[${index + 1}/15] ${category}: selected ${selected.length}\n`);
}

const finalDeduplication = deduplicateCandidates(evaluated, archive);
const candidatesPath = resolve(outputDirectory, "candidates.json");
const dedupeReportPath = resolve(outputDirectory, "dedupe-report.json");
const selectionReportPath = resolve(outputDirectory, "selection-report.json");
const decisionsPath = resolve(outputDirectory, "editorial-decisions.json");
const reportPath = resolve(outputDirectory, "review-report.json");
const manifestPath = resolve(outputDirectory, "manifest.json");
await writeFile(candidatesPath, `${JSON.stringify(finalDeduplication.candidates, null, 2)}\n`, { mode: 0o600 });
await writeFile(dedupeReportPath, `${JSON.stringify(finalDeduplication.rejected, null, 2)}\n`, { mode: 0o600 });
const runner = new URL("./run.mjs", import.meta.url).pathname;
const { stdout } = await execFileAsync(process.execPath, [runner, "--input", candidatesPath, "--date", editionDate], {
  maxBuffer: 10 * 1024 * 1024,
});
await writeFile(selectionReportPath, stdout, { mode: 0o600 });
const selectionReport = JSON.parse(stdout);
let decisions;
if (resume) {
  try {
    decisions = JSON.parse(await readFile(decisionsPath, "utf8"));
    process.stderr.write(`Final editorial review: resumed ${decisions.length} decisions\n`);
  } catch {}
}
if (!decisions) {
  process.stderr.write(`Final editorial review: evaluating ${selectionReport.selected.length} stories with Luna\n`);
  decisions = await reviewEdition({
    stories: selectionReport.selected,
    model: process.env.OPENAI_NEWSROOM_MODEL ?? "gpt-5.6-luna",
  });
  await writeFile(decisionsPath, `${JSON.stringify(decisions, null, 2)}\n`, { mode: 0o600 });
}
const reviewedStories = applyEditorialDecisions(selectionReport.selected, decisions);
const editorialReview = {
  inputStories: selectionReport.selected.length,
  finalStories: reviewedStories.length,
  kept: decisions.filter((decision) => decision.action === "keep").length,
  moved: decisions.filter((decision) => decision.action === "move").length,
  removed: decisions.filter((decision) => decision.action === "remove").length,
};
const report = { ...selectionReport, selected: reviewedStories, editorialReview };
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
const manifest = {
  editionDate,
  ...window,
  model: process.env.OPENAI_NEWSROOM_MODEL ?? "gpt-5.6-luna",
  archiveStoriesCompared: archive.length,
  evaluatedCandidates: evaluated.length,
  uniqueCandidates: finalDeduplication.candidates.length,
  selectedStories: report.selected.length,
  sectionsWithStories: new Set(report.selected.map((story) => story.category)).size,
  editorialReview,
  categoryStats,
  files: {
    candidates: candidatesPath,
    dedupeReport: dedupeReportPath,
    selectionReport: selectionReportPath,
    editorialDecisions: decisionsPath,
    reviewReport: reportPath,
  },
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify(manifest, null, 2));
