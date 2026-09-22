import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "#cdata",
  textNodeName: "#text",
});

export const SOURCE_TIERS = {
  primary: { credibilityScore: 98, isPrimarySource: true },
  major: { credibilityScore: 92, isPrimarySource: false },
  specialist: { credibilityScore: 88, isPrimarySource: false },
};

const PUBLISHER_DOMAINS = {
  NPR: ["npr.org"],
  BBC: ["bbc.com", "bbc.co.uk"],
  "The New York Times": ["nytimes.com"],
  "ESPN News": ["espn.com"],
  CalMatters: ["calmatters.org"],
  "California Governor": ["gov.ca.gov"],
  "NASA News Releases": ["nasa.gov"],
  "NOAA News": ["noaa.gov"],
  "The Verge": ["theverge.com"],
  Wired: ["wired.com"],
  "IGN Games": ["ign.com"],
  Polygon: ["polygon.com"],
  "GamesIndustry.biz": ["gamesindustry.biz"],
  Eurogamer: ["eurogamer.net"],
  "PC Gamer": ["pcgamer.com"],
  "Rock Paper Shotgun": ["rockpapershotgun.com"],
  "HR Dive": ["hrdive.com"],
  "The Guardian": ["theguardian.com"],
  "Fast Company": ["fastcompany.com"],
  "U.S. Department of Labor": ["dol.gov"],
  "KFF Health News": ["kffhealthnews.org"],
  STAT: ["statnews.com"],
  Vox: ["vox.com"],
  TechCrunch: ["techcrunch.com"],
  Mashable: ["mashable.com"],
  "Social Media Today": ["socialmediatoday.com"],
  "Inside Higher Ed": ["insidehighered.com"],
  HousingWire: ["housingwire.com"],
};

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
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function link(item) {
  if (typeof item.link === "string") return item.link;
  const embeddedLink = text(item.link).trim();
  if (embeddedLink) return embeddedLink;
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

function publishedDate(value) {
  // Some reviewed RSS feeds emit ISO timestamps without an explicit offset.
  // Treat those values as UTC so GitHub (UTC) and local Pacific runs apply the
  // same coverage window instead of silently disagreeing by seven/eight hours.
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value}Z`
    : value;
  return new Date(normalized);
}

function matchingDomain(hostname, domains) {
  return domains.find((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function reviewedSourcePolicies(sources, category) {
  const policies = [];
  const seen = new Set();
  for (const source of sources.filter((entry) => entry.categories.includes(category))) {
    const publisherName = source.publisher ?? source.name;
    if (seen.has(publisherName)) continue;
    const domains = source.articleDomains ?? PUBLISHER_DOMAINS[publisherName];
    if (!domains?.length) continue;
    const sourcePolicy = SOURCE_TIERS[source.tier];
    if (!sourcePolicy) throw new Error(`${source.name}: unknown source tier ${source.tier}`);
    policies.push({
      sourceName: source.name,
      publisherName,
      domains,
      ...sourcePolicy,
    });
    seen.add(publisherName);
  }
  return policies;
}

export function groundRetrievedCandidates(candidates, {
  category, sources, coverageStartsAt, coverageEndsAt,
}) {
  const policies = reviewedSourcePolicies(sources, category);
  const startsAt = Date.parse(coverageStartsAt);
  const endsAt = Date.parse(coverageEndsAt);
  const grounded = [];
  const rejected = [];
  for (const candidate of candidates) {
    let url;
    try {
      url = new URL(candidate.canonicalUrl);
    } catch {
      rejected.push({ candidate, reason: "invalid-url" });
      continue;
    }
    const publishedAt = Date.parse(candidate.publishedAt);
    if (candidate.category !== category) {
      rejected.push({ candidate, reason: "wrong-category" });
      continue;
    }
    if (!Number.isFinite(publishedAt) || publishedAt < startsAt || publishedAt > endsAt) {
      rejected.push({ candidate, reason: "outside-coverage-window" });
      continue;
    }
    const policy = policies.find((entry) => matchingDomain(url.hostname.toLowerCase(), entry.domains));
    if (!policy) {
      rejected.push({ candidate, reason: "unreviewed-source-domain" });
      continue;
    }
    grounded.push({
      ...candidate,
      category,
      sourceName: policy.sourceName,
      publisherName: policy.publisherName,
      publishedAt: new Date(publishedAt).toISOString(),
      scores: { ...candidate.scores, sourceQuality: policy.credibilityScore },
    });
  }
  return { candidates: grounded, rejected };
}

export function parseFeed(xml, source) {
  const sourcePolicy = SOURCE_TIERS[source.tier];
  if (!sourcePolicy) throw new Error(`${source.name}: unknown source tier ${source.tier}`);
  const document = parser.parse(xml);
  const rssItems = list(document.rss?.channel?.item);
  const atomItems = list(document.feed?.entry);
  return [...rssItems, ...atomItems].flatMap((item) => {
    const rawDate = clean(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]);
    const publishedAt = publishedDate(rawDate);
    const canonicalUrl = link(item);
    const headline = clean(item.title);
    if (!headline || !validHttpUrl(canonicalUrl) || Number.isNaN(publishedAt.getTime())) return [];
    return [{
      headline,
      canonicalUrl,
      sourceName: source.name,
      publisherName: source.publisher ?? source.name,
      sourceTier: source.tier,
      ...sourcePolicy,
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
