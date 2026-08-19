import type { Metadata } from "next";
import { getPublishedEdition } from "../lib/news/repository";
import { DailyEdition } from "./DailyEdition";

export const metadata: Metadata = {
  title: "Your Daily Tea — Today",
  description: "One frozen daily briefing, sourced and organized in 15 sections.",
};

export default async function Home() {
  const edition = await getPublishedEdition();
  return <DailyEdition edition={edition} />;
}
