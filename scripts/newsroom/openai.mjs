const CATEGORY_BRIEFS = {
  usa: "Major United States news excluding stories that fit Politics + Policy more directly.",
  california: "Statewide California news and consequential regional developments.",
  world: "International events, diplomacy, conflict, elections, and major cross-border developments.",
  "tech-ai": "AI, Big Tech, startups, cybersecurity, products, and computing infrastructure.",
  "science-planet": "Research, space, discoveries, climate, environment, energy, and extreme weather.",
  "health-wellness": "Medicine, public health, nutrition, fitness, mental health, and health research.",
  "money-economy": "Markets, inflation, rates, housing costs, personal finance, and the economy.",
  "politics-policy": "US government, courts, elections, legislation, regulation, and public policy.",
  "jobs-work": "Hiring, layoffs, salaries, workplaces, entry-level trends, and AI effects on work.",
  sports: "Major games, championships, records, trades, athletes, and culturally significant sports news.",
  "internet-trends": "Creators, memes, social platforms, viral moments, and notable internet debates.",
  gaming: "Games, studios, consoles, industry news, esports, and culturally significant releases.",
  "life-society": "Education, housing, immigration, relationships, demographics, and social change.",
  "pop-culture": "Movies, television, music, celebrities, fashion, books, awards, and entertainment business.",
  "other-notable": "Worthwhile concrete news that genuinely does not fit another section.",
};

const SCORE_PROPERTIES = Object.fromEntries(
  ["importance", "interestingness", "relevance", "newness", "sourceQuality", "momentum"]
    .map((name) => [name, { type: "integer", minimum: 0, maximum: 100 }]),
);

export const CANDIDATE_SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: Object.keys(CATEGORY_BRIEFS) },
          headline: { type: "string" },
          summary: { type: "string" },
          canonicalUrl: { type: "string" },
          sourceName: { type: "string" },
          publishedAt: { type: "string" },
          topics: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
          scores: {
            type: "object",
            properties: SCORE_PROPERTIES,
            required: Object.keys(SCORE_PROPERTIES),
            additionalProperties: false,
          },
        },
        required: ["category", "headline", "summary", "canonicalUrl", "sourceName", "publishedAt", "topics", "scores"],
        additionalProperties: false,
      },
    },
  },
  required: ["candidates"],
  additionalProperties: false,
};

function responseText(payload) {
  if (payload.output_text) return payload.output_text;
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return null;
}

export function retrievalRequest({ category, coverageStartsAt, coverageEndsAt, model = "gpt-5.4-mini" }) {
  const brief = CATEGORY_BRIEFS[category];
  if (!brief) throw new Error(`Unknown retrieval category: ${category}`);
  return {
    model,
    tools: [{ type: "web_search" }],
    input: [
      "You are a careful research desk for a concise morning news briefing.",
      `Research only this section: ${category}. ${brief}`,
      `Accept only events with source publication times from ${coverageStartsAt} through ${coverageEndsAt}, inclusive.`,
      "Find zero to eight genuinely worthwhile candidates. Quiet sections may return zero.",
      "Prefer primary sources and original reporting. Treat social signals as discovery only.",
      "Do not reproduce article prose. Write an original, factual two-to-four sentence summary.",
      "Use the canonical source URL, an ISO-8601 publication timestamp, and two to five normalized topic names.",
      "Score every dimension independently from 0 to 100. Do not select merely to fill space.",
    ].join("\n"),
    text: {
      format: {
        type: "json_schema",
        name: "news_candidates",
        strict: true,
        schema: CANDIDATE_SCHEMA,
      },
    },
    max_output_tokens: 5000,
  };
}

export async function retrieveCategory(options, fetchImpl = fetch) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for retrieval.");
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(retrievalRequest(options)),
  });
  const payload = await response.json();
  if (!response.ok) {
    const code = payload.error?.code ?? payload.error?.type ?? `http_${response.status}`;
    throw new Error(`OpenAI retrieval failed (${code}): ${payload.error?.message ?? "Unknown error"}`);
  }
  const text = responseText(payload);
  if (!text) throw new Error("OpenAI retrieval returned no structured text.");
  const parsed = JSON.parse(text);
  return parsed.candidates;
}

export const CATEGORY_SLUGS = Object.freeze(Object.keys(CATEGORY_BRIEFS));
