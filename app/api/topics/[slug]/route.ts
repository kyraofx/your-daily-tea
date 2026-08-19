import { resolveDateRange } from "../../../../lib/news/date-range";
import { listPublishedTopicStories } from "../../../../lib/news/repository";

const TOPIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!TOPIC_SLUG.test(slug)) {
    return Response.json({ error: "Invalid topic slug." }, { status: 400 });
  }

  try {
    const range = resolveDateRange(new URL(request.url).searchParams);
    const stories = await listPublishedTopicStories(slug, range.from, range.to);
    return Response.json({ topic: slug, range, stories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Topic service is unavailable.";
    const status = message.startsWith("Custom ranges") || message.startsWith("Range must") ? 400 : 503;
    if (status === 503) console.error(error);
    return Response.json({ error: message }, { status });
  }
}
