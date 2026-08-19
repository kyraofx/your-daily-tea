import { searchPublishedStories } from "../../../lib/news/repository";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) {
    return Response.json({ error: "Search must contain 2–80 characters." }, { status: 400 });
  }
  try {
    return Response.json({ query, stories: await searchPublishedStories(query) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Search service is unavailable." }, { status: 503 });
  }
}
