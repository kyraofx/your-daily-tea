const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: string | null): value is string {
  return !!value && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function resolveDateRange(search: URLSearchParams, now = new Date()) {
  const range = search.get("range") ?? "all";
  const today = isoDate(now);

  if (range === "all") return {};
  if (range === "today") return { from: today, to: today };
  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 6 : 29;
    const start = new Date(`${today}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - days);
    return { from: isoDate(start), to: today };
  }
  if (range === "custom") {
    const from = search.get("from");
    const to = search.get("to");
    if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
      throw new Error("Custom ranges require valid from/to dates in YYYY-MM-DD order.");
    }
    return { from, to };
  }

  throw new Error("Range must be all, today, 7d, 30d, or custom.");
}
