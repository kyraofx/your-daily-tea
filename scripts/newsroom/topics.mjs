function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeTopics(topics) {
  if (!Array.isArray(topics)) throw new Error("two to five valid unique topics are required");

  const normalized = new Map();
  for (const topic of topics) {
    if (typeof topic !== "string") throw new Error("topics must be strings");
    const name = topic.trim().replace(/\s+/g, " ");
    const slug = slugify(name);
    if (!name || !slug) continue;
    if (!normalized.has(slug)) normalized.set(slug, { name, slug });
  }

  const result = [...normalized.values()];
  if (result.length < 2 || result.length > 5) {
    throw new Error("two to five valid unique topics are required");
  }
  return result;
}
