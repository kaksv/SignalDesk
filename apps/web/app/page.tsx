type HealthResponse = {
  ok: boolean;
  service: string;
};

type Market = {
  id: string;
  question: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "SETTLED";
  feeBps: number;
  closeAt: string;
};

async function fetchApi<T>(path: string): Promise<T | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const health = await fetchApi<HealthResponse>("/health");
  const marketsPayload = await fetchApi<{ markets: Market[] }>("/markets");
  const markets = marketsPayload?.markets ?? [];
  const hasApiUrl = Boolean(process.env.NEXT_PUBLIC_API_URL);

  return (
    <main style={{ fontFamily: "Inter, sans-serif", margin: "3rem auto", maxWidth: 800 }}>
      <h1>SignalDesk</h1>
      <p>
        Institutional prediction markets on Canton.
      </p>
      <section style={{ marginTop: "1.5rem", padding: "1rem", border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Deployment Check</h2>
        {!hasApiUrl && <p>Set `NEXT_PUBLIC_API_URL` in Vercel to connect this app to Render.</p>}
        {hasApiUrl && !health && <p>API unreachable. Verify Render URL and CORS settings.</p>}
        {hasApiUrl && health && (
          <p>
            Connected to <strong>{health.service}</strong> and API health is OK.
          </p>
        )}
      </section>

      <section style={{ marginTop: "1.5rem", padding: "1rem", border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Live Markets</h2>
        {markets.length === 0 && <p>No markets yet. Create one through the operator API.</p>}
        {markets.map((market) => (
          <article key={market.id} style={{ marginBottom: "0.85rem" }}>
            <strong>{market.question}</strong>
            <div>Status: {market.status}</div>
            <div>Fee: {(market.feeBps / 100).toFixed(2)}%</div>
          </article>
        ))}
      </section>
    </main>
  );
}
