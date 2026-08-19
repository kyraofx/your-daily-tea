import type { Metadata } from "next";
import { getPublishedEdition, listPublishedEditions, listPublishedTopics } from "../lib/news/repository";
import { DailyEdition } from "./DailyEdition";

export const metadata: Metadata = {
  title: "Your Daily Tea — Today",
  description: "One frozen daily briefing, sourced and organized in 15 sections.",
};

export default async function Home() {
  const [edition, editions, topics] = await Promise.all([
    getPublishedEdition(), listPublishedEditions(100), listPublishedTopics(),
  ]);
  return <DailyEdition edition={edition} editions={editions} topics={topics} />;
}
