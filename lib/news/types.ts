export const SECTION_ORDER = [
  "usa",
  "california",
  "world",
  "tech-ai",
  "science-planet",
  "health-wellness",
  "money-economy",
  "politics-policy",
  "jobs-work",
  "sports",
  "internet-trends",
  "gaming",
  "life-society",
  "pop-culture",
  "other-notable",
] as const;

export type SectionSlug = (typeof SECTION_ORDER)[number];

export type Topic = {
  name: string;
  slug: string;
};

export type Story = {
  id: string;
  headline: string;
  summary: string;
  canonicalUrl: string;
  sourceName: string;
  publishedAt: string;
  section: SectionSlug;
  rank: number;
  topics: Topic[];
};

export type Edition = {
  id: string;
  editionDate: string;
  editionNumber: number;
  coverageStartsAt: string;
  coverageEndsAt: string;
  publishedAt: string;
  sections: Partial<Record<SectionSlug, Story[]>>;
};

export type EditionSummary = Pick<
  Edition,
  "id" | "editionDate" | "editionNumber" | "publishedAt"
>;

export type TopicSummary = Topic & {
  storyCount: number;
  latestEditionDate: string;
};

export type TopicStory = Omit<Story, "topics"> & {
  editionId: string;
  editionDate: string;
  topic: Topic;
};

export type SearchStory = Story & {
  editionId: string;
  editionDate: string;
};
