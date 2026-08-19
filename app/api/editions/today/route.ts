import { getPublishedEdition } from "../../../../lib/news/repository";

export async function GET() {
  try {
    const edition = await getPublishedEdition();
    if (!edition) return Response.json({ error: "No published edition yet." }, { status: 404 });
    return Response.json(edition);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Edition service is unavailable." }, { status: 503 });
  }
}

