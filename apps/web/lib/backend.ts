const baseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL;

function requireBaseUrl() {
  if (!baseUrl) {
    throw new Error("Missing API base URL. Set API_BASE_URL or NEXT_PUBLIC_API_URL.");
  }
  return baseUrl;
}

export async function backendRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${requireBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { message: await response.text() };

  return { ok: response.ok, status: response.status, payload };
}

export function getOperatorHeaders() {
  const key = process.env.OPERATOR_API_KEY;
  if (!key) {
    throw new Error("Missing OPERATOR_API_KEY in Vercel environment variables.");
  }
  return { "x-operator-key": key };
}
