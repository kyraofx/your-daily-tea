export function selectBalancedEdition(accepted, categories, {
  maxPerCategory = 4,
  maxPerSourcePerCategory = 2,
  maxPerSourcePerEdition = 6,
} = {}) {
  const selected = [];
  const editionSourceCounts = new Map();
  for (const category of categories) {
    const categorySelection = [];
    const primaryTopics = new Set();
    const categorySourceCounts = new Map();
    for (const item of accepted.filter((candidate) => candidate.category === category)
      .sort((a, b) => b.weightedScore - a.weightedScore)) {
      const primaryTopic = item.topics[0]?.slug;
      if (primaryTopic && primaryTopics.has(primaryTopic)) continue;
      if ((categorySourceCounts.get(item.sourceName) ?? 0) >= maxPerSourcePerCategory) continue;
      if ((editionSourceCounts.get(item.sourceName) ?? 0) >= maxPerSourcePerEdition) continue;
      categorySelection.push(item);
      if (primaryTopic) primaryTopics.add(primaryTopic);
      categorySourceCounts.set(item.sourceName, (categorySourceCounts.get(item.sourceName) ?? 0) + 1);
      editionSourceCounts.set(item.sourceName, (editionSourceCounts.get(item.sourceName) ?? 0) + 1);
      if (categorySelection.length === maxPerCategory) break;
    }
    selected.push(...categorySelection.map((item, index) => ({ ...item, rank: index + 1 })));
  }
  return selected;
}
