import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../.github/workflows/daily-edition.yml", import.meta.url), "utf8");

test("daily automation retries safely after the primary Pacific run", () => {
  assert.match(workflow, /cron: "7,22,37,52 6 \* \* \*"/);
  assert.match(workflow, /cron: "7 7 \* \* \*"/);
  assert.equal(workflow.match(/timezone: "America\/Los_Angeles"/g)?.length, 2);
  assert.match(workflow, /queue: max/);
  assert.match(workflow, /Check whether today's edition is already published/);
  assert.match(workflow, /steps\.existing\.outputs\.published != 'true'/);
  assert.match(workflow, /Edition preflight returned HTTP \$STATUS; failing closed\./);
  assert.match(workflow, /NEWSROOM_MINIMUM_STORIES: "30"/);
  assert.match(workflow, /NEWSROOM_MINIMUM_SECTIONS: "15"/);
  assert.match(workflow, /NEWSROOM_MINIMUM_STORIES_PER_SECTION: "2"/);
});
