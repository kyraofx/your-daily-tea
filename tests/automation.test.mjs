import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../.github/workflows/daily-edition.yml", import.meta.url), "utf8");

test("daily automation retries safely after the primary Pacific run", () => {
  assert.match(workflow, /cron: "7,22,37,52 6 \* \* \*"/);
  assert.match(workflow, /cron: "7 7 \* \* \*"/);
  assert.equal(workflow.match(/timezone: "America\/Los_Angeles"/g)?.length, 2);
  assert.match(workflow, /Check whether today's edition is already published/);
  assert.match(workflow, /steps\.existing\.outputs\.published != 'true'/);
  assert.match(workflow, /Edition preflight returned HTTP \$STATUS; failing closed\./);
});
