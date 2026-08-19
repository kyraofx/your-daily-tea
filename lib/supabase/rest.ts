type QueryValue = string | number | boolean;

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url: url.replace(/\/$/, ""), key };
}

export async function supabaseGet<T>(
  table: string,
  query: Record<string, QueryValue>,
): Promise<T> {
  const { url, key } = config();
  const params = new URLSearchParams();

  for (const [name, value] of Object.entries(query)) {
    params.set(name, String(value));
  }

  const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}).`);
  }

  return (await response.json()) as T;
}
