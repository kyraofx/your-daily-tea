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

  function floorOptions(state, target) {
    const options = [];
    const visit = (start, chosen, sourceCounts, canonicalUrls) => {
      if (chosen.length === target) {
        options.push(chosen);
        return;
      }
      for (let index = start; index < state.candidates.length; index += 1) {
        const item = state.candidates[index];
        const publisher = item.publisherName ?? item.sourceName;
        if (canonicalUrls.has(item.canonicalUrl)) continue;
        if ((sourceCounts.get(publisher) ?? 0) >= maxPerSourcePerCategory) continue;
        const nextSourceCounts = new Map(sourceCounts);
        nextSourceCounts.set(publisher, (nextSourceCounts.get(publisher) ?? 0) + 1);
        visit(index + 1, [...chosen, item], nextSourceCounts, new Set([...canonicalUrls, item.canonicalUrl]));
      }
    };
    visit(0, [], new Map(), new Set());
    return options.sort((left, right) => (
      right.reduce((total, item) => total + item.weightedScore, 0)
      - left.reduce((total, item) => total + item.weightedScore, 0)
    ));
  }

  function reserveAllFloors(target) {
    const optionsByCategory = new Map(categoryList.map((category) => [
      category,
      floorOptions(states.get(category), target),
    ]));
    if ([...optionsByCategory.values()].some((options) => options.length === 0)) return false;
    const order = [...categoryList].sort((left, right) => (
      optionsByCategory.get(left).length - optionsByCategory.get(right).length
      || categoryList.indexOf(left) - categoryList.indexOf(right)
    ));
    let attempts = 0;
    const attemptLimit = 250_000;
    const reserve = (index) => {
      if (index === order.length) return true;
      if (attempts >= attemptLimit) return false;
      const category = order[index];
      for (const option of optionsByCategory.get(category)) {
        attempts += 1;
        if (option.some((item) => selectedCanonicalUrls.has(item.canonicalUrl))) continue;
        const optionSourceCounts = new Map();
        for (const item of option) {
          const publisher = item.publisherName ?? item.sourceName;
          optionSourceCounts.set(publisher, (optionSourceCounts.get(publisher) ?? 0) + 1);
        }
        if ([...optionSourceCounts].some(([publisher, count]) => (
          (editionSourceCounts.get(publisher) ?? 0) + count > maxPerSourcePerEdition
        ))) continue;

        const state = states.get(category);
        for (const item of option) {
          const publisher = item.publisherName ?? item.sourceName;
          const primaryTopic = item.topics[0]?.slug;
          state.selected.push(item);
          selectedCanonicalUrls.add(item.canonicalUrl);
          if (primaryTopic) state.primaryTopics.add(primaryTopic);
          state.sourceCounts.set(publisher, (state.sourceCounts.get(publisher) ?? 0) + 1);
          editionSourceCounts.set(publisher, (editionSourceCounts.get(publisher) ?? 0) + 1);
        }
        if (reserve(index + 1)) return true;
        for (const item of option) {
          const publisher = item.publisherName ?? item.sourceName;
          state.selected.pop();
          selectedCanonicalUrls.delete(item.canonicalUrl);
          state.sourceCounts.set(publisher, state.sourceCounts.get(publisher) - 1);
          editionSourceCounts.set(publisher, editionSourceCounts.get(publisher) - 1);
        }
        state.primaryTopics = new Set(state.selected.map((item) => item.topics[0]?.slug).filter(Boolean));
      }
      return false;
    };
    return reserve(0);
  }

  // Reserve each section's minimum before filling any section. Solve the floor
  // assignments together so a locally good publisher choice cannot starve a
  // later section. If no complete assignment exists, keep the scarcity-ordered
  // partial result and let the publication quality gate fail closed.
  const reservationTarget = Math.min(minimumPerCategory, maxPerCategory);
  if (!reserveAllFloors(reservationTarget)) {
    const reservationOrder = [...categoryList].sort((left, right) => {
      const leftSelectable = selectable(states.get(left));
      const rightSelectable = selectable(states.get(right));
      const publisherCount = (items) => new Set(items.map((item) => item.publisherName ?? item.sourceName)).size;
      return publisherCount(leftSelectable) - publisherCount(rightSelectable)
        || leftSelectable.length - rightSelectable.length
        || categoryList.indexOf(left) - categoryList.indexOf(right);
    });
    for (const category of reservationOrder) {
      const state = states.get(category);
      while (state.selected.length < reservationTarget && addBest(category, { allowPrimaryTopicRepeat: true })) {
        // addBest mutates the state until the floor is reached or candidates run out.
      }
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
