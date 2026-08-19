import { getPublishedEdition } from "../../../../lib/news/repository";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ date: string }> },
) {
  const { date } = await context.params;
  if (!ISO_DATE.test(date)) {
    return Response.json({ error: "Use a date in YYYY-MM-DD format." }, { status: 400 });
  }

  try {
    const edition = await getPublishedEdition(date);
    if (!edition) return Response.json({ error: "Edition not found." }, { status: 404 });
    return Response.json(edition);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Edition service is unavailable." }, { status: 503 });
  }
}

