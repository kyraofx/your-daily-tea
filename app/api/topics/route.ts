import { listPublishedTopics } from "../../../lib/news/repository";

export async function GET() {
  try {
    return Response.json({ topics: await listPublishedTopics() });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Topic service is unavailable." }, { status: 503 });
  }
}
