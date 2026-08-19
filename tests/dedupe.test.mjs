import assert from "node:assert/strict";
import test from "node:test";
import { fetchPublishedArchive } from "../scripts/newsroom/archive.mjs";
import { deduplicateCandidates, headlineSimilarity } from "../scripts/newsroom/dedupe.mjs";

const base = {
  category: "usa", sourceName: "Source", publishedAt: "2026-08-19T01:00:00.000Z",
  scores: { sourceQuality: 80 },
};

test("headline similarity ignores common words and punctuation", () => {
  assert.ok(headlineSimilarity(
    "Ohio plant explosions kill two workers",
    "Two workers killed in explosions at Ohio plant",
  ) > 0.7);
});

test("keeps the higher-quality version of a current event", () => {
  const lower = { ...base, headline: "Ohio plant explosions kill two workers", canonicalUrl: "https://low.example/story", scores: { sourceQuality: 70 } };
  const higher = { ...base, headline: "Two workers killed in explosions at Ohio plant", canonicalUrl: "https://high.example/story", scores: { sourceQuality: 95 } };
  const result = deduplicateCandidates([lower, higher]);
  assert.deepEqual(result.candidates, [higher]);
  assert.equal(result.rejected[0].reason, "duplicate-current-event");
});

test("rejects a story already covered by the published archive", () => {
  const candidate = { ...base, headline: "Two workers killed in explosions at Ohio plant", canonicalUrl: "https://new.example/story" };
  const archive = [{ ...base, headline: "Ohio plant explosions kill two workers", canonicalUrl: "https://old.example/story" }];
  const result = deduplicateCandidates([candidate], archive);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.rejected[0].reason, "covered-in-published-archive");
});

test("archive lookup uses the published security-invoker view", async () => {
  const fakeFetch = async (url, init) => {
    assert.match(url, /published_edition_stories/);
    assert.equal(init.headers.apikey, "publishable-key");
    return { ok: true, json: async () => [{
      headline: "Archived", canonical_url: "https://example.com/archived",
      published_at: "2026-08-18T01:00:00Z", edition_date: "2026-08-18", section_slug: "usa",
    }] };
  };
  const [story] = await fetchPublishedArchive({
    supabaseUrl: "https://project.supabase.co", apiKey: "publishable-key",
    since: "2026-07-19T00:00:00Z", fetchImpl: fakeFetch,
  });
  assert.equal(story.canonicalUrl, "https://example.com/archived");
});

test("malformed candidate URLs do not crash similarity deduplication", () => {
  const one = { ...base, headline: "First unrelated story", canonicalUrl: "not-a-url" };
  const two = { ...base, headline: "Second unrelated report", canonicalUrl: "also-not-a-url" };
  assert.equal(deduplicateCandidates([one, two]).candidates.length, 2);
});
