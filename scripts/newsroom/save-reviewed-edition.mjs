import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import process from "node:process";
import { createRestClient, saveReviewedDraft } from "./persistence.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

for (const file of [".env.local", `${homedir()}/.config/your-daily-tea/secrets.env`]) {
  try {
    for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // Each environment file is optional.
  }
}

const input = argument("--input");
if (!input) throw new Error("Use --input <final-review-report.json>.");
const report = JSON.parse(await readFile(input, "utf8"));
const rest = createRestClient({
  supabaseUrl: process.env.SUPABASE_URL,
  secretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
});
console.log(JSON.stringify(await saveReviewedDraft(report, rest), null, 2));
