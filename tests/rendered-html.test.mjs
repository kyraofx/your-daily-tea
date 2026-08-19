import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the homepage is the finished daily-edition experience", async () => {
  const [page, component, layout, styles, packageJson, favicon] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/DailyEdition.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("public/tea-favicon.svg", root), "utf8"),
  ]);

  assert.match(page, /getPublishedEdition\(\)/);
  assert.match(component, /Morning, internet\./);
  assert.match(component, /SECTION_ORDER\.map/);
  assert.match(component, /Internet \+ Trends/);
  assert.match(component, /story\.canonicalUrl/);
  assert.match(component, /story\.topics\.map/);
  assert.match(component, /pickEdition/);
  assert.match(component, /pickTopic/);
  assert.match(component, /submitSearch/);
  assert.match(component, /\/api\/search/);
  assert.match(component, /useState\(""\)/);
  assert.doesNotMatch(component, /AI jobs/);
  assert.match(layout, /title: "Your Daily Tea"/);
  assert.match(layout, /tea-favicon\.svg/);
  assert.match(favicon, /#94bce3/);
  assert.match(styles, /--steel: #94bce3/);
  assert.doesNotMatch(page + layout, /codex-preview|SkeletonPreview|Starter Project/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
