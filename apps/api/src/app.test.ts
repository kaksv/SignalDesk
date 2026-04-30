import { describe, expect, it, beforeEach } from "vitest";
import { buildApp } from "./app.js";

type MarketRecord = {
  id: string;
  question: string;
  closeAt: Date;
  feeBps: number;
  status: "DRAFT" | "OPEN" | "CLOSED" | "SETTLED";
  outcome: boolean | null;
  settlementRef: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PositionRecord = {
  id: string;
  marketId: string;
  userId: string;
  yesShares: number;
  noShares: number;
  cashFlow: number;
  totalFeesPaid: number;
  createdAt: Date;
  updatedAt: Date;
};

type PayoutRecord = {
  id: string;
  marketId: string;
  userId: string;
  positionId: string;
  grossPayout: number;
  netPayout: number;
  status: "PENDING" | "CLAIMED";
  createdAt: Date;
  updatedAt: Date;
};

function createPrismaMock() {
  const db = new Map<string, MarketRecord>();
  const positions = new Map<string, PositionRecord>();
  const payouts = new Map<string, PayoutRecord>();
  const trades = new Map<string, unknown>();

  return {
    market: {
      findMany: async () => Array.from(db.values()),
      findUnique: async ({ where: { id } }: { where: { id: string } }) => db.get(id) ?? null,
      create: async ({ data }: { data: Omit<MarketRecord, "createdAt" | "updatedAt" | "outcome" | "settlementRef"> }) => {
        const now = new Date();
        const rec: MarketRecord = {
          ...data,
          outcome: null,
          settlementRef: null,
          createdAt: now,
          updatedAt: now
        };
        db.set(rec.id, rec);
        return rec;
      },
      update: async ({ where: { id }, data }: { where: { id: string }; data: Partial<MarketRecord> }) => {
        const found = db.get(id);
        if (!found) {
          throw new Error("missing");
        }
        const updated = { ...found, ...data, updatedAt: new Date() };
        db.set(id, updated);
        return updated;
      }
    },
    trade: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        trades.set(String(data.id), data);
        return data;
      }
    },
    position: {
      findUnique: async ({
        where: {
          marketId_userId
        }
      }: {
        where: { marketId_userId: { marketId: string; userId: string } };
      }) => positions.get(`${marketId_userId.marketId}:${marketId_userId.userId}`) ?? null,
      upsert: async ({
        where: {
          marketId_userId
        },
        create,
        update
      }: {
        where: { marketId_userId: { marketId: string; userId: string } };
        create: PositionRecord;
        update: Partial<PositionRecord>;
      }) => {
        const key = `${marketId_userId.marketId}:${marketId_userId.userId}`;
        const found = positions.get(key);
        if (!found) {
          const rec = { ...create, createdAt: new Date(), updatedAt: new Date() };
          positions.set(key, rec);
          return rec;
        }
        const updatedRecord = { ...found, ...update, updatedAt: new Date() };
        positions.set(key, updatedRecord);
        return updatedRecord;
      },
      findMany: async ({ where: { marketId } }: { where: { marketId: string } }) =>
        Array.from(positions.values()).filter((p) => p.marketId === marketId)
    },
    payout: {
      upsert: async ({
        where: {
          marketId_userId
        },
        create,
        update
      }: {
        where: { marketId_userId: { marketId: string; userId: string } };
        create: PayoutRecord;
        update: Partial<PayoutRecord>;
      }) => {
        const key = `${marketId_userId.marketId}:${marketId_userId.userId}`;
        const found = payouts.get(key);
        if (!found) {
          const rec = { ...create, createdAt: new Date(), updatedAt: new Date() };
          payouts.set(key, rec);
          return rec;
        }
        const updatedRecord = { ...found, ...update, updatedAt: new Date() };
        payouts.set(key, updatedRecord);
        return updatedRecord;
      },
      findMany: async ({ where: { marketId } }: { where: { marketId: string } }) =>
        Array.from(payouts.values()).filter((p) => p.marketId === marketId)
    }
  };
}

describe("market lifecycle", () => {
  beforeEach(() => {
    process.env.OPERATOR_API_KEY = "test-key";
  });

  it("creates market in DRAFT when operator key is valid", async () => {
    const prisma = createPrismaMock();
    const app = buildApp(prisma as never);

    const res = await app.inject({
      method: "POST",
      url: "/markets",
      headers: { "x-operator-key": "test-key" },
      payload: {
        id: "mkt_1",
        question: "Will inflation print below 3.0% in Q3?",
        closeAtIso: "2026-09-30T00:00:00.000Z",
        feeBps: 25
      }
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().market.status).toBe("DRAFT");
    await app.close();
  });

  it("rejects invalid status transition from DRAFT to CLOSED", async () => {
    const prisma = createPrismaMock();
    await prisma.market.create({
      data: {
        id: "mkt_2",
        question: "Will unemployment rise by year-end?",
        closeAt: new Date("2026-11-30T00:00:00.000Z"),
        feeBps: 15,
        status: "DRAFT"
      }
    });
    const app = buildApp(prisma as never);

    const res = await app.inject({
      method: "PATCH",
      url: "/markets/mkt_2/status",
      headers: { "x-operator-key": "test-key" },
      payload: { status: "CLOSED" }
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it("settles only after market is CLOSED", async () => {
    const prisma = createPrismaMock();
    await prisma.market.create({
      data: {
        id: "mkt_3",
        question: "Will gold close above 2600 by month-end?",
        closeAt: new Date("2026-07-31T00:00:00.000Z"),
        feeBps: 20,
        status: "CLOSED"
      }
    });
    const app = buildApp(prisma as never);

    const res = await app.inject({
      method: "POST",
      url: "/markets/mkt_3/settle",
      headers: { "x-operator-key": "test-key" },
      payload: { outcome: true, settlementRef: "oracle-signed-evt-77" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().market.status).toBe("SETTLED");
    await app.close();
  });

  it("records trade and updates position for open markets", async () => {
    const prisma = createPrismaMock();
    await prisma.market.create({
      data: {
        id: "mkt_4",
        question: "Will CPI print under forecast this month?",
        closeAt: new Date("2026-08-01T00:00:00.000Z"),
        feeBps: 25,
        status: "OPEN"
      }
    });
    const app = buildApp(prisma as never);

    const res = await app.inject({
      method: "POST",
      url: "/markets/mkt_4/trades",
      payload: {
        userId: "trader_1",
        side: "BUY",
        outcomeSide: "YES",
        quantity: 10,
        price: 0.62
      }
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().position.yesShares).toBe(10);
    await app.close();
  });

  it("prevents selling more shares than user owns", async () => {
    const prisma = createPrismaMock();
    await prisma.market.create({
      data: {
        id: "mkt_5",
        question: "Will BTC close green this week?",
        closeAt: new Date("2026-08-07T00:00:00.000Z"),
        feeBps: 15,
        status: "OPEN"
      }
    });
    const app = buildApp(prisma as never);

    const res = await app.inject({
      method: "POST",
      url: "/markets/mkt_5/trades",
      payload: {
        userId: "trader_2",
        side: "SELL",
        outcomeSide: "YES",
        quantity: 3,
        price: 0.55
      }
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("insufficient_shares");
    await app.close();
  });
});
