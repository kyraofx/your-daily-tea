import assert from "node:assert/strict";
import test from "node:test";
import { collectFeeds, parseFeed } from "../scripts/newsroom/feeds.mjs";

const source = { name: "Test Source", url: "https://example.com/feed", tier: "major", categories: ["usa"] };
const xml = `<?xml version="1.0"?><rss><channel>
  <item><title>Inside window</title><link>https://example.com/inside?utm_source=rss</link><pubDate>Tue, 18 Aug 2026 08:00:00 GMT</pubDate><description><![CDATA[<p>A useful summary.</p>]]></description></item>
  <item><title>Outside window</title><link>https://example.com/outside</link><pubDate>Mon, 17 Aug 2026 08:00:00 GMT</pubDate></item>
</channel></rss>`;

test("parses normalized RSS items", () => {
  const [item] = parseFeed(xml, source);
  assert.equal(item.headline, "Inside window");
  assert.equal(item.publishedAt, "2026-08-18T08:00:00.000Z");
  assert.equal(item.sourceSummary, "A useful summary.");
  assert.equal(item.credibilityScore, 92);
  assert.equal(item.isPrimarySource, false);
});

test("collects only in-window category candidates", async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => xml });
  const result = await collectFeeds({
    sources: [source], category: "usa",
    coverageStartsAt: "2026-08-17T13:00:00.000Z",
    coverageEndsAt: "2026-08-18T12:59:59.999Z",
    fetchImpl,
  });
  assert.equal(result.sourcesChecked, 1);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.errors.length, 0);
});

test("rejects feed GUIDs that are not HTTP URLs", () => {
  const invalid = `<rss><channel><item><title>Invalid link</title><guid>US-EN-49651586</guid><pubDate>Tue, 18 Aug 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
  assert.deepEqual(parseFeed(invalid, source), []);
});
