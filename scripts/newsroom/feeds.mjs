import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "#cdata",
  textNodeName: "#text",
});

function list(value) {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

function text(value) {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  return String(value["#text"] ?? value["#cdata"] ?? "");
}

function clean(value) {
  return text(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function link(item) {
  if (typeof item.link === "string") return item.link;
  for (const candidate of list(item.link)) {
    if (candidate?.["@_rel"] === "alternate" && candidate?.["@_href"]) return candidate["@_href"];
    if (candidate?.["@_href"]) return candidate["@_href"];
  }
  return text(item.guid);
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseFeed(xml, source) {
  const document = parser.parse(xml);
  const rssItems = list(document.rss?.channel?.item);
  const atomItems = list(document.feed?.entry);
  return [...rssItems, ...atomItems].flatMap((item) => {
    const rawDate = clean(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]);
    const publishedAt = new Date(rawDate);
    const canonicalUrl = link(item);
    const headline = clean(item.title);
    if (!headline || !validHttpUrl(canonicalUrl) || Number.isNaN(publishedAt.getTime())) return [];
    return [{
      headline,
      canonicalUrl,
      sourceName: source.name,
      publishedAt: publishedAt.toISOString(),
      sourceCategories: source.categories,
      sourceSummary: clean(item.description ?? item.summary ?? item.content),
    }];
  });
}

export async function collectFeeds({ sources, category, coverageStartsAt, coverageEndsAt, fetchImpl = fetch }) {
  const startsAt = Date.parse(coverageStartsAt);
  const endsAt = Date.parse(coverageEndsAt);
  const selectedSources = sources.filter((source) => source.categories.includes(category));
  const results = await Promise.allSettled(selectedSources.map(async (source) => {
    const response = await fetchImpl(source.url, { headers: { "User-Agent": "YourDailyTea/0.1 feed-reader" } });
    if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
    return parseFeed(await response.text(), source);
  }));
  const errors = [];
  const seen = new Set();
  const candidates = [];
  for (const result of results) {
    if (result.status === "rejected") {
      errors.push(result.reason?.message ?? String(result.reason));
      continue;
    }
    for (const candidate of result.value) {
      const timestamp = Date.parse(candidate.publishedAt);
      if (timestamp < startsAt || timestamp > endsAt) continue;
      const key = candidate.canonicalUrl.replace(/[?#].*$/, "").replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { candidates, errors, sourcesChecked: selectedSources.length };
}
