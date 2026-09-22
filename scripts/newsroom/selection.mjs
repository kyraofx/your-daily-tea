export function selectBalancedEdition(accepted, categories, {
  maxPerCategory = 4,
  minimumPerCategory = 2,
  maxPerSourcePerCategory = 2,
  maxPerSourcePerEdition = 6,
} = {}) {
  const categoryList = [...categories];
  const editionSourceCounts = new Map();
  const selectedCanonicalUrls = new Set();
  const states = new Map(categoryList.map((category) => [category, {
    candidates: accepted.filter((candidate) => candidate.category === category)
      .sort((a, b) => b.weightedScore - a.weightedScore),
    selected: [],
    primaryTopics: new Set(),
    sourceCounts: new Map(),
  }]));

  function selectable(state, { allowPrimaryTopicRepeat = false } = {}) {
    return state.candidates.filter((item) => {
      if (state.selected.includes(item)) return false;
      if (selectedCanonicalUrls.has(item.canonicalUrl)) return false;
      const publisher = item.publisherName ?? item.sourceName;
      const primaryTopic = item.topics[0]?.slug;
      if (!allowPrimaryTopicRepeat && primaryTopic && state.primaryTopics.has(primaryTopic)) return false;
      if ((state.sourceCounts.get(publisher) ?? 0) >= maxPerSourcePerCategory) return false;
      if ((editionSourceCounts.get(publisher) ?? 0) >= maxPerSourcePerEdition) return false;
      return true;
    });
  }

  function addBest(category, options) {
    const state = states.get(category);
    const [item] = selectable(state, options);
    if (!item) return false;
    const publisher = item.publisherName ?? item.sourceName;
    const primaryTopic = item.topics[0]?.slug;
    state.selected.push(item);
    selectedCanonicalUrls.add(item.canonicalUrl);
    if (primaryTopic) state.primaryTopics.add(primaryTopic);
    state.sourceCounts.set(publisher, (state.sourceCounts.get(publisher) ?? 0) + 1);
    editionSourceCounts.set(publisher, (editionSourceCounts.get(publisher) ?? 0) + 1);
    return true;
  }

  // Reserve each section's minimum before filling any section. Sections that
  // can meet the floor but have fewer alternatives choose first, preventing
  // broad earlier desks from consuming a shared publisher's edition-wide cap.
  const reservationTarget = Math.min(minimumPerCategory, maxPerCategory);
  const reservationOrder = [...categoryList].sort((left, right) => {
    const leftAvailable = selectable(states.get(left)).length;
    const rightAvailable = selectable(states.get(right)).length;
    return leftAvailable - rightAvailable || categoryList.indexOf(left) - categoryList.indexOf(right);
  });
  for (const category of reservationOrder) {
    const state = states.get(category);
    while (state.selected.length < reservationTarget && addBest(category, { allowPrimaryTopicRepeat: true })) {
      // addBest mutates the state until the floor is reached or candidates run out.
    }
  }

  // After every section has had its minimum opportunity, fill the remaining
  // slots in display order while preserving the same diversity constraints.
  for (const category of categoryList) {
    const state = states.get(category);
    while (state.selected.length < maxPerCategory && addBest(category)) {
      // addBest mutates the state until no eligible candidate remains.
    }
  }

  return categoryList.flatMap((category) => states.get(category).selected
    .map((item, index) => ({ ...item, rank: index + 1 })));
}
