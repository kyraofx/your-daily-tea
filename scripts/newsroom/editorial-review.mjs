import { CATEGORY_SLUGS, responseText } from "./openai.mjs";
import { selectBalancedEdition } from "./selection.mjs";

function nullableString(schema = { type: "string" }) {
  return { anyOf: [schema, { type: "null" }] };
}

function storyId(index) {
  return `story-${String(index + 1).padStart(3, "0")}`;
}

export function editorialReviewRequest({ stories, model = "gpt-5.6-luna" }) {
  const storyIds = stories.map((_story, index) => storyId(index));
  const schema = {
    type: "object",
    properties: {
      decisions: {
        type: "array",
        minItems: stories.length,
        maxItems: stories.length,
        items: {
          type: "object",
          properties: {
            storyId: { type: "string", enum: storyIds },
            action: { type: "string", enum: ["keep", "remove", "move"] },
            targetCategory: nullableString({ type: "string", enum: CATEGORY_SLUGS }),
            reason: { type: "string", enum: ["keep", "duplicate-event", "category-mismatch", "low-value"] },
            duplicateOf: nullableString({ type: "string", enum: storyIds }),
          },
          required: ["storyId", "action", "targetCategory", "reason", "duplicateOf"],
          additionalProperties: false,
        },
      },
    },
    required: ["decisions"],
    additionalProperties: false,
  };
  const supplied = stories.map(({ canonicalUrl, category, headline, summary, sourceName, weightedScore }, index) => ({
    storyId: storyId(index), canonicalUrl, category, headline, summary, sourceName, weightedScore,
  }));
  return {
    model,
    reasoning: { effort: "none" },
    input: [
      "You are the final cross-section editor for a concise US morning briefing.",
      "Return exactly one decision for every supplied storyId, using each storyId exactly once. Never create, alter, or infer an ID.",
      "Keep a story when it is worthwhile and correctly categorized. Move it only when another of the 15 sections is clearly better.",
      "Remove lower-value coverage when two stories describe the same underlying event, even if their headlines use different wording. Set duplicateOf to the kept storyId.",
      "USA is for consequential domestic news; foreign wars and diplomacy belong in World, while elections, government, courts, and regulation usually belong in Politics + Policy.",
      "Other Notable must not duplicate another section. A publishable edition needs at least two qualifying stories in every section, but never keep low-value or duplicate coverage merely to reach that minimum; deterministic code will hold an underfilled edition.",
      "For keep: targetCategory and duplicateOf must be null and reason must be keep.",
      "For move: set targetCategory, duplicateOf null, and reason category-mismatch.",
      "For remove: targetCategory null and use duplicate-event with duplicateOf, or low-value with duplicateOf null.",
      `Stories:\n${JSON.stringify(supplied)}`,
    ].join("\n"),
    text: { format: { type: "json_schema", name: "edition_editorial_review", strict: true, schema } },
    max_output_tokens: 7000,
  };
}

function validateDecisions(stories, decisions) {
  const known = new Set(stories.map((_story, index) => storyId(index)));
  const decided = new Set();
  for (const decision of decisions) {
    if (!known.has(decision.storyId)) throw new Error(`Editorial review returned unknown story ID: ${decision.storyId}`);
    if (decided.has(decision.storyId)) throw new Error(`Editorial review duplicated story ID: ${decision.storyId}`);
    decided.add(decision.storyId);
    if (decision.duplicateOf && !known.has(decision.duplicateOf)) {
      throw new Error(`Editorial review referenced unknown duplicate story ID: ${decision.duplicateOf}`);
    }
    if (decision.action === "move" && !CATEGORY_SLUGS.includes(decision.targetCategory)) {
      throw new Error(`Editorial review returned invalid target category: ${decision.targetCategory}`);
    }
  }
  if (decided.size !== known.size) throw new Error(`Editorial review covered ${decided.size} of ${known.size} stories.`);
}

export async function reviewEdition(options, fetchImpl = fetch) {
  if (options.stories.length === 0) return [];
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for editorial review.");
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(editorialReviewRequest(options)),
  });
  const payload = await response.json();
  if (!response.ok) {
    const code = payload.error?.code ?? payload.error?.type ?? `http_${response.status}`;
    throw new Error(`OpenAI editorial review failed (${code}): ${payload.error?.message ?? "Unknown error"}`);
  }
  const output = responseText(payload);
  if (!output) throw new Error("OpenAI editorial review returned no structured text.");
  const decisions = JSON.parse(output).decisions;
  validateDecisions(options.stories, decisions);
  const byId = new Map(options.stories.map((story, index) => [storyId(index), story.canonicalUrl]));
  return decisions.map(({ storyId: selectedStoryId, duplicateOf, ...decision }) => ({
    ...decision,
    canonicalUrl: byId.get(selectedStoryId),
    duplicateOf: duplicateOf ? byId.get(duplicateOf) : null,
  }));
}

export function applyEditorialDecisions(stories, decisions, { minimumPerCategory = 2 } = {}) {
  const byUrl = new Map(decisions.map((decision) => [decision.canonicalUrl, decision]));
  const retained = stories.flatMap((story) => {
    const decision = byUrl.get(story.canonicalUrl);
    if (!decision || (decision.action === "remove" && !["low-value", "duplicate-event"].includes(decision.reason))) return [];
    return [{
      ...story,
      originalCategory: story.category,
      category: decision.action === "move" ? decision.targetCategory : story.category,
      advisoryRemoval: decision.action === "remove" && decision.reason === "low-value",
      duplicateRemoval: decision.action === "remove" && decision.reason === "duplicate-event",
      duplicateOf: decision.duplicateOf,
    }];
  });
  const active = retained.filter((story) => !story.advisoryRemoval && !story.duplicateRemoval);
  let selected = selectBalancedEdition(active.map((story) => ({ ...story, rank: undefined })), CATEGORY_SLUGS);
  const deficit = (selection) => CATEGORY_SLUGS.reduce((total, category) => (
    total + Math.max(0, minimumPerCategory - selection.filter((story) => story.category === category).length)
  ), 0);
  for (const category of CATEGORY_SLUGS) {
    if (retained.filter((story) => story.originalCategory === category).length < minimumPerCategory) continue;
    while (selected.filter((story) => story.category === category).length < minimumPerCategory) {
      const restoration = active
        .filter((story) => story.originalCategory === category && story.category !== category)
        .sort((left, right) => right.weightedScore - left.weightedScore)[0];
      if (!restoration) break;
      restoration.category = category;
      selected = selectBalancedEdition(active.map((story) => ({ ...story, rank: undefined })), CATEGORY_SLUGS);
    }
    while (selected.filter((story) => story.category === category).length < minimumPerCategory) {
      const restoration = retained
        .filter((story) => story.advisoryRemoval && story.originalCategory === category)
        .sort((left, right) => right.weightedScore - left.weightedScore)[0];
      if (!restoration) break;
      restoration.advisoryRemoval = false;
      restoration.category = category;
      active.push(restoration);
      selected = selectBalancedEdition(active.map((story) => ({ ...story, rank: undefined })), CATEGORY_SLUGS);
    }
    for (const restoration of retained
      .filter((story) => story.duplicateRemoval && story.originalCategory === category)
      .sort((left, right) => right.weightedScore - left.weightedScore)) {
      if (selected.filter((story) => story.category === category).length >= minimumPerCategory) break;
      const beforeDeficit = deficit(selected);
      const duplicateIndex = active.findIndex((story) => story.canonicalUrl === restoration.duplicateOf);
      const [replaced] = duplicateIndex >= 0 ? active.splice(duplicateIndex, 1) : [];
      restoration.duplicateRemoval = false;
      restoration.category = category;
      active.push(restoration);
      const next = selectBalancedEdition(active.map((story) => ({ ...story, rank: undefined })), CATEGORY_SLUGS);
      if (deficit(next) < beforeDeficit) {
        selected = next;
      } else {
        active.pop();
        restoration.duplicateRemoval = true;
        if (replaced) active.splice(duplicateIndex, 0, replaced);
      }
    }
  }
  return selected.map(({
    originalCategory: _originalCategory,
    advisoryRemoval: _advisoryRemoval,
    duplicateRemoval: _duplicateRemoval,
    duplicateOf: _duplicateOf,
    ...story
  }) => story);
}
