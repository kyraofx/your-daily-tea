import { isIsoDate } from "../../../lib/news/date-range";
import { listPublishedEditions } from "../../../lib/news/repository";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const requestedLimit = Number(search.get("limit") ?? 31);
  const before = search.get("before");

  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
    return Response.json({ error: "Limit must be between 1 and 100." }, { status: 400 });
  }
  if (before && !isIsoDate(before)) {
    return Response.json({ error: "Before must use YYYY-MM-DD." }, { status: 400 });
  }

  try {
    return Response.json({ editions: await listPublishedEditions(requestedLimit, before ?? undefined) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Archive service is unavailable." }, { status: 503 });
  }
}
