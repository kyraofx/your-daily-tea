const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is", "it",
  "its", "new", "of", "on", "says", "that", "the", "their", "to", "was", "will", "with",
]);

function normalizedUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  }
  url.pathname = url.pathname.replace(/\/$/, "") || "/";
  return url.toString();
}

function headlineTokens(value) {
  return new Set(value.toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token)));
}

export function headlineSimilarity(left, right) {
  const a = headlineTokens(left);
  const b = headlineTokens(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / (a.size + b.size - intersection);
}

function sameStory(left, right, threshold) {
  const leftUrl = normalizedUrl(left.canonicalUrl);
  const rightUrl = normalizedUrl(right.canonicalUrl);
  if (leftUrl && rightUrl && leftUrl === rightUrl) return true;
  const leftTime = Date.parse(left.publishedAt);
  const rightTime = Date.parse(right.publishedAt);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return false;
  if (Math.abs(leftTime - rightTime) > 48 * 60 * 60 * 1000) return false;
  return headlineSimilarity(left.headline, right.headline) >= threshold;
}

function quality(candidate) {
  const weighted = Number(candidate.weightedScore);
  if (Number.isFinite(weighted)) return weighted;
  const sourceQuality = Number(candidate.scores?.sourceQuality);
  return Number.isFinite(sourceQuality) ? sourceQuality : 0;
}

export function deduplicateCandidates(candidates, archive = [], { threshold = 0.5 } = {}) {
  const kept = [];
  const rejected = [];
  const ordered = [...candidates].sort((a, b) => quality(b) - quality(a));
  for (const candidate of ordered) {
    const archived = archive.find((story) => sameStory(candidate, story, threshold));
    if (archived) {
      rejected.push({ candidate, reason: "covered-in-published-archive", matchedHeadline: archived.headline });
      continue;
    }
    const duplicate = kept.find((story) => sameStory(candidate, story, threshold));
    if (duplicate) {
      rejected.push({ candidate, reason: "duplicate-current-event", matchedHeadline: duplicate.headline });
      continue;
    }
    kept.push(candidate);
  }
  return { candidates: kept, rejected };
}
