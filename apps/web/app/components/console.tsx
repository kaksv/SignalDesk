"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Market = {
  id: string;
  question: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "SETTLED";
  feeBps: number;
};

type Props = {
  markets: Market[];
};

type Position = {
  userId: string;
  yesShares: number;
  noShares: number;
  cashFlow: number;
  totalFeesPaid: number;
};

type Payout = {
  userId: string;
  grossPayout: number;
  netPayout: number;
  status: "PENDING" | "CLAIMED";
};

export function Console({ markets }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);
  const [selectedMarketId, setSelectedMarketId] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState("");

  const marketIds = useMemo(() => markets.map((m) => m.id), [markets]);
  const defaultMarketId = marketIds[0] ?? "";

  useEffect(() => {
    if (!selectedMarketId && defaultMarketId) {
      setSelectedMarketId(defaultMarketId);
    }
  }, [defaultMarketId, selectedMarketId]);

  async function refreshPanels(marketId: string) {
    if (!marketId) {
      setPositions([]);
      setPayouts([]);
      return;
    }

    setIsPanelLoading(true);
    setPanelError("");
    try {
      const [positionsRes, payoutsRes] = await Promise.all([
        fetch(`/api/markets/${marketId}/positions`, { cache: "no-store" }),
        fetch(`/api/markets/${marketId}/payouts`, { cache: "no-store" })
      ]);

      const positionsPayload = await positionsRes.json();
      const payoutsPayload = await payoutsRes.json();

      if (!positionsRes.ok) {
        throw new Error(positionsPayload.error ?? "Failed to fetch positions");
      }
      if (!payoutsRes.ok) {
        throw new Error(payoutsPayload.error ?? "Failed to fetch payouts");
      }

      setPositions((positionsPayload.positions ?? []) as Position[]);
      setPayouts((payoutsPayload.payouts ?? []) as Payout[]);
    } catch (err) {
      setPanelError((err as Error).message);
    } finally {
      setIsPanelLoading(false);
    }
  }

  useEffect(() => {
    void refreshPanels(selectedMarketId);
  }, [selectedMarketId]);

  async function submit(path: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
    setIsBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }
      setMessage("Action completed successfully.");
      router.refresh();
      const marketId = typeof body.marketId === "string" ? body.marketId : selectedMarketId;
      await refreshPanels(marketId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsBusy(false);
    }
  }

  function onCreateMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit("/api/operator/markets", "POST", {
      id: String(form.get("id") ?? ""),
      question: String(form.get("question") ?? ""),
      closeAtIso: String(form.get("closeAtIso") ?? ""),
      feeBps: Number(form.get("feeBps") ?? 25)
    });
  }

  function onChangeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const marketId = String(form.get("marketId") ?? "");
    const status = String(form.get("status") ?? "OPEN");
    const expectedCurrentStatus = status === "OPEN" ? "DRAFT" : "OPEN";
    void submit(`/api/operator/markets/${marketId}/status`, "PATCH", {
      status,
      expectedCurrentStatus
    });
  }

  function onSettle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const marketId = String(form.get("marketId") ?? "");
    const winningSide = String(form.get("winningSide") ?? "YES");
    void submit(`/api/operator/markets/${marketId}/settle`, "POST", {
      outcome: winningSide === "YES",
      settlementRef: String(form.get("settlementRef") ?? "")
    });
  }

  function onTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const marketId = String(form.get("marketId") ?? "");
    void submit(`/api/markets/${marketId}/trades`, "POST", {
      userId: String(form.get("userId") ?? ""),
      side: String(form.get("side") ?? "BUY"),
      outcomeSide: String(form.get("outcomeSide") ?? "YES"),
      quantity: Number(form.get("quantity") ?? 1),
      price: Number(form.get("price") ?? 0.5)
    });
  }

  return (
    <section style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
      <h2 style={{ marginBottom: 0 }}>Operator + Trader Console</h2>
      {error && (
        <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>
          {error}
        </p>
      )}
      {message && (
        <p style={{ color: "#166534", margin: 0 }}>
          {message}
        </p>
      )}

      <form onSubmit={onCreateMarket} style={{ border: "1px solid #ddd", borderRadius: 12, padding: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Create Market</h3>
        <label htmlFor="id">Market ID</label>
        <input id="id" name="id" type="text" required style={{ display: "block", width: "100%", marginBottom: 8 }} />
        <label htmlFor="question">Question</label>
        <input id="question" name="question" type="text" required style={{ display: "block", width: "100%", marginBottom: 8 }} />
        <label htmlFor="closeAtIso">Close Time (ISO)</label>
        <input id="closeAtIso" name="closeAtIso" type="text" required placeholder="2026-12-31T21:00:00.000Z" style={{ display: "block", width: "100%", marginBottom: 8 }} />
        <label htmlFor="feeBps">Fee (bps)</label>
        <input id="feeBps" name="feeBps" type="number" min={0} max={500} defaultValue={25} style={{ display: "block", width: "100%", marginBottom: 12 }} />
        <button type="submit" disabled={isBusy}>{isBusy ? "Submitting..." : "Create Market"}</button>
      </form>

      <form onSubmit={onChangeStatus} style={{ border: "1px solid #ddd", borderRadius: 12, padding: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Change Market Status</h3>
        <label htmlFor="statusMarketId">Market</label>
        <select
          id="statusMarketId"
          name="marketId"
          value={selectedMarketId}
          onChange={(event) => setSelectedMarketId(event.target.value)}
          required
          style={{ display: "block", width: "100%", marginBottom: 8 }}
        >
          {marketIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue="OPEN" style={{ display: "block", width: "100%", marginBottom: 12 }}>
          <option value="OPEN">OPEN</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <button type="submit" disabled={isBusy || marketIds.length === 0}>
          {isBusy ? "Submitting..." : "Update Status"}
        </button>
      </form>

      <form onSubmit={onTrade} style={{ border: "1px solid #ddd", borderRadius: 12, padding: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Place Trade</h3>
        <label htmlFor="tradeMarketId">Market</label>
        <select
          id="tradeMarketId"
          name="marketId"
          value={selectedMarketId}
          onChange={(event) => setSelectedMarketId(event.target.value)}
          required
          style={{ display: "block", width: "100%", marginBottom: 8 }}
        >
          {marketIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <label htmlFor="userId">User ID</label>
        <input id="userId" name="userId" type="text" defaultValue="trader_demo" required style={{ display: "block", width: "100%", marginBottom: 8 }} />
        <label htmlFor="side">Side</label>
        <select id="side" name="side" defaultValue="BUY" style={{ display: "block", width: "100%", marginBottom: 8 }}>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <label htmlFor="outcomeSide">Outcome Side</label>
        <select id="outcomeSide" name="outcomeSide" defaultValue="YES" style={{ display: "block", width: "100%", marginBottom: 8 }}>
          <option value="YES">YES</option>
          <option value="NO">NO</option>
        </select>
        <label htmlFor="quantity">Quantity</label>
        <input id="quantity" name="quantity" type="number" min={1} defaultValue={10} style={{ display: "block", width: "100%", marginBottom: 8 }} />
        <label htmlFor="price">Price (0-1)</label>
        <input id="price" name="price" type="number" min={0.01} max={1} step="0.01" defaultValue={0.6} style={{ display: "block", width: "100%", marginBottom: 12 }} />
        <button type="submit" disabled={isBusy || marketIds.length === 0}>
          {isBusy ? "Submitting..." : "Place Trade"}
        </button>
      </form>

      <form onSubmit={onSettle} style={{ border: "1px solid #ddd", borderRadius: 12, padding: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Settle Market</h3>
        <label htmlFor="settleMarketId">Market</label>
        <select
          id="settleMarketId"
          name="marketId"
          value={selectedMarketId}
          onChange={(event) => setSelectedMarketId(event.target.value)}
          required
          style={{ display: "block", width: "100%", marginBottom: 8 }}
        >
          {marketIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <label htmlFor="winningSide">Winning Side</label>
        <select id="winningSide" name="winningSide" defaultValue="YES" style={{ display: "block", width: "100%", marginBottom: 8 }}>
          <option value="YES">YES</option>
          <option value="NO">NO</option>
        </select>
        <label htmlFor="settlementRef">Settlement Reference</label>
        <input id="settlementRef" name="settlementRef" type="text" defaultValue="manual-oracle-ref" required style={{ display: "block", width: "100%", marginBottom: 12 }} />
        <button type="submit" disabled={isBusy || marketIds.length === 0}>
          {isBusy ? "Submitting..." : "Settle Market"}
        </button>
      </form>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Live Exposures (Positions)</h3>
        <button
          type="button"
          onClick={() => void refreshPanels(selectedMarketId)}
          disabled={isPanelLoading || !selectedMarketId}
          style={{ marginBottom: 10 }}
        >
          {isPanelLoading ? "Refreshing..." : "Refresh Positions & Payouts"}
        </button>
        {panelError && (
          <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>
            {panelError}
          </p>
        )}
        {!panelError && positions.length === 0 && <p>No positions yet for this market.</p>}
        {positions.map((position) => (
          <article key={position.userId} style={{ marginBottom: "0.75rem" }}>
            <strong>{position.userId}</strong>
            <div>YES shares: {position.yesShares}</div>
            <div>NO shares: {position.noShares}</div>
            <div>Cash flow: {position.cashFlow.toFixed(2)}</div>
            <div>Fees paid: {position.totalFeesPaid.toFixed(2)}</div>
          </article>
        ))}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Live Settlement Outcomes (Payouts)</h3>
        {!panelError && payouts.length === 0 && <p>No payouts yet for this market.</p>}
        {payouts.map((payout) => (
          <article key={payout.userId} style={{ marginBottom: "0.75rem" }}>
            <strong>{payout.userId}</strong>
            <div>Gross payout: {payout.grossPayout.toFixed(2)}</div>
            <div>Net payout: {payout.netPayout.toFixed(2)}</div>
            <div>Status: {payout.status}</div>
          </article>
        ))}
      </section>
    </section>
  );
}
