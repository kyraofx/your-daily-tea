import { CATEGORY_SLUGS, responseText } from "./openai.mjs";
import { selectBalancedEdition } from "./selection.mjs";

function nullableString(schema = { type: "string" }) {
  return { anyOf: [schema, { type: "null" }] };
}

export function editorialReviewRequest({ stories, model = "gpt-5.6-luna" }) {
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
            canonicalUrl: { type: "string" },
            action: { type: "string", enum: ["keep", "remove", "move"] },
            targetCategory: nullableString({ type: "string", enum: CATEGORY_SLUGS }),
            reason: { type: "string", enum: ["keep", "duplicate-event", "category-mismatch", "low-value"] },
            duplicateOf: nullableString(),
          },
          required: ["canonicalUrl", "action", "targetCategory", "reason", "duplicateOf"],
          additionalProperties: false,
        },
      },
    },
    required: ["decisions"],
    additionalProperties: false,
  };
  const supplied = stories.map(({ canonicalUrl, category, headline, summary, sourceName, weightedScore }) => ({
    canonicalUrl, category, headline, summary, sourceName, weightedScore,
  }));
  return {
    model,
    reasoning: { effort: "none" },
    input: [
      "You are the final cross-section editor for a concise US morning briefing.",
      "Return exactly one decision for every supplied URL, using each URL exactly once.",
      "Keep a story when it is worthwhile and correctly categorized. Move it only when another of the 15 sections is clearly better.",
      "Remove lower-value coverage when two stories describe the same underlying event, even if their headlines use different wording. Set duplicateOf to the kept story URL.",
      "USA is for consequential domestic news; foreign wars and diplomacy belong in World, while elections, government, courts, and regulation usually belong in Politics + Policy.",
      "Other Notable must not duplicate another section. Do not fill a section for the sake of having content.",
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
  const known = new Set(stories.map((story) => story.canonicalUrl));
  const decided = new Set();
  for (const decision of decisions) {
    if (!known.has(decision.canonicalUrl)) throw new Error(`Editorial review returned unknown URL: ${decision.canonicalUrl}`);
    if (decided.has(decision.canonicalUrl)) throw new Error(`Editorial review duplicated URL: ${decision.canonicalUrl}`);
    decided.add(decision.canonicalUrl);
    if (decision.duplicateOf && !known.has(decision.duplicateOf)) {
      throw new Error(`Editorial review referenced unknown duplicate URL: ${decision.duplicateOf}`);
    }
    if (decision.action === "move" && !CATEGORY_SLUGS.includes(decision.targetCategory)) {
      throw new Error(`Editorial review returned invalid target category: ${decision.targetCategory}`);
    }
  }
  if (decided.size !== known.size) throw new Error(`Editorial review covered ${decided.size} of ${known.size} stories.`);
}

export async function reviewEdition(options, fetchImpl = fetch) {
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
  return decisions;
}

export function applyEditorialDecisions(stories, decisions) {
  const byUrl = new Map(decisions.map((decision) => [decision.canonicalUrl, decision]));
  const retained = stories.flatMap((story) => {
    const decision = byUrl.get(story.canonicalUrl);
    if (!decision || decision.action === "remove") return [];
    return [{ ...story, category: decision.action === "move" ? decision.targetCategory : story.category }];
  });
  return selectBalancedEdition(retained.map((story) => ({ ...story, rank: undefined })), CATEGORY_SLUGS);
}
