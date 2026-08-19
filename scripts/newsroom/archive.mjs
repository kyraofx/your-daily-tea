export async function fetchPublishedArchive({ supabaseUrl, apiKey, since, fetchImpl = fetch }) {
  if (!supabaseUrl || !apiKey) throw new Error("Archive lookup requires SUPABASE_URL and a Supabase API key.");
  const query = new URLSearchParams({
    select: "headline,canonical_url,published_at,edition_date,section_slug",
    published_at: `gte.${since}`,
    order: "published_at.desc",
    limit: "2000",
  });
  const response = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/published_edition_stories?${query}`, {
    headers: { apikey: apiKey },
  });
  if (!response.ok) throw new Error(`Supabase archive lookup failed (${response.status}): ${await response.text()}`);
  return (await response.json()).map((story) => ({
    headline: story.headline,
    canonicalUrl: story.canonical_url,
    publishedAt: story.published_at,
    editionDate: story.edition_date,
    category: story.section_slug,
  }));
}
