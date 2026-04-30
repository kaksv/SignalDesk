import Fastify from "fastify";
import cors from "@fastify/cors";
import { MarketStatus, OutcomeSide, OrderSide, PrismaClient } from "@prisma/client";
import { z } from "zod";

const createMarketSchema = z.object({
  id: z.string().min(3),
  question: z.string().min(10),
  closeAtIso: z.string().datetime(),
  feeBps: z.number().int().min(0).max(500)
});

const setStatusSchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]),
  expectedCurrentStatus: z.enum(["DRAFT", "OPEN"]).optional()
});

const settleSchema = z.object({
  outcome: z.boolean(),
  settlementRef: z.string().min(3)
});

const tradeSchema = z.object({
  userId: z.string().min(3),
  side: z.nativeEnum(OrderSide),
  outcomeSide: z.nativeEnum(OutcomeSide),
  quantity: z.number().int().positive().max(100000),
  price: z.number().positive().max(1)
});

const operatorHeaderSchema = z.object({
  "x-operator-key": z.string()
});

function isTransitionAllowed(current: MarketStatus, next: MarketStatus): boolean {
  const allowed: Record<MarketStatus, MarketStatus[]> = {
    DRAFT: ["OPEN"],
    OPEN: ["CLOSED"],
    CLOSED: ["SETTLED"],
    SETTLED: []
  };
  return allowed[current].includes(next);
}

export function buildApp(prisma: PrismaClient) {
  const app = Fastify({ logger: true });
  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

  void app.register(cors, {
    origin: corsOrigin,
    methods: ["GET", "POST", "PATCH", "OPTIONS"]
  });

  app.get("/health", async () => ({ ok: true, service: "signaldesk-api" }));

  app.get("/markets", async () => {
    const markets = await prisma.market.findMany({ orderBy: { createdAt: "desc" } });
    return { markets };
  });

  app.post("/markets", async (request, reply) => {
    const headers = operatorHeaderSchema.safeParse(request.headers);
    if (!headers.success || headers.data["x-operator-key"] !== process.env.OPERATOR_API_KEY) {
      reply.code(401);
      return { error: "unauthorized_operator" };
    }

    const input = createMarketSchema.parse(request.body);
    const market = await prisma.market.create({
      data: {
        id: input.id,
        question: input.question,
        closeAt: new Date(input.closeAtIso),
        feeBps: input.feeBps,
        status: "DRAFT"
      }
    });
    reply.code(201);
    return { market };
  });

  app.patch("/markets/:id/status", async (request, reply) => {
    const headers = operatorHeaderSchema.safeParse(request.headers);
    if (!headers.success || headers.data["x-operator-key"] !== process.env.OPERATOR_API_KEY) {
      reply.code(401);
      return { error: "unauthorized_operator" };
    }

    const params = z.object({ id: z.string() }).parse(request.params);
    const input = setStatusSchema.parse(request.body);
    const market = await prisma.market.findUnique({ where: { id: params.id } });

    if (!market) {
      reply.code(404);
      return { error: "market_not_found" };
    }

    if (input.expectedCurrentStatus && market.status !== input.expectedCurrentStatus) {
      reply.code(409);
      return { error: "unexpected_current_status", currentStatus: market.status };
    }

    if (!isTransitionAllowed(market.status, input.status)) {
      reply.code(422);
      return { error: "invalid_status_transition", from: market.status, to: input.status };
    }

    const updated = await prisma.market.update({
      where: { id: market.id },
      data: { status: input.status }
    });

    return { market: updated };
  });

  app.post("/markets/:id/trades", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = tradeSchema.parse(request.body);
    const market = await prisma.market.findUnique({ where: { id: params.id } });

    if (!market) {
      reply.code(404);
      return { error: "market_not_found" };
    }

    if (market.status !== "OPEN") {
      reply.code(422);
      return { error: "market_not_open", status: market.status };
    }

    const notional = input.quantity * input.price;
    const feeAmount = (notional * market.feeBps) / 10000;
    const positionId = `${market.id}:${input.userId}`;

    const existingPosition = await prisma.position.findUnique({
      where: { marketId_userId: { marketId: market.id, userId: input.userId } }
    });

    const yesShares = existingPosition?.yesShares ?? 0;
    const noShares = existingPosition?.noShares ?? 0;
    const heldShares = input.outcomeSide === "YES" ? yesShares : noShares;

    if (input.side === "SELL" && heldShares < input.quantity) {
      reply.code(422);
      return {
        error: "insufficient_shares",
        heldShares,
        attemptedSellQuantity: input.quantity
      };
    }

    const shareDelta = input.side === "BUY" ? input.quantity : -input.quantity;
    const cashDelta = input.side === "BUY" ? -(notional + feeAmount) : notional - feeAmount;

    const updatedPosition = await prisma.position.upsert({
      where: { marketId_userId: { marketId: market.id, userId: input.userId } },
      create: {
        id: positionId,
        marketId: market.id,
        userId: input.userId,
        yesShares: input.outcomeSide === "YES" ? Math.max(shareDelta, 0) : 0,
        noShares: input.outcomeSide === "NO" ? Math.max(shareDelta, 0) : 0,
        cashFlow: cashDelta,
        totalFeesPaid: feeAmount
      },
      update: {
        yesShares: input.outcomeSide === "YES" ? yesShares + shareDelta : yesShares,
        noShares: input.outcomeSide === "NO" ? noShares + shareDelta : noShares,
        cashFlow: (existingPosition?.cashFlow ?? 0) + cashDelta,
        totalFeesPaid: (existingPosition?.totalFeesPaid ?? 0) + feeAmount
      }
    });

    const trade = await prisma.trade.create({
      data: {
        id: `${market.id}:${input.userId}:${Date.now()}`,
        marketId: market.id,
        userId: input.userId,
        side: input.side,
        outcomeSide: input.outcomeSide,
        quantity: input.quantity,
        price: input.price,
        notional,
        feeAmount
      }
    });

    reply.code(201);
    return { trade, position: updatedPosition };
  });

  app.get("/markets/:id/positions", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const market = await prisma.market.findUnique({ where: { id: params.id } });

    if (!market) {
      reply.code(404);
      return { error: "market_not_found" };
    }

    const positions = await prisma.position.findMany({ where: { marketId: market.id } });
    return { positions };
  });

  app.post("/markets/:id/settle", async (request, reply) => {
    const headers = operatorHeaderSchema.safeParse(request.headers);
    if (!headers.success || headers.data["x-operator-key"] !== process.env.OPERATOR_API_KEY) {
      reply.code(401);
      return { error: "unauthorized_operator" };
    }

    const params = z.object({ id: z.string() }).parse(request.params);
    const input = settleSchema.parse(request.body);
    const market = await prisma.market.findUnique({ where: { id: params.id } });

    if (!market) {
      reply.code(404);
      return { error: "market_not_found" };
    }

    if (!isTransitionAllowed(market.status, "SETTLED")) {
      reply.code(422);
      return { error: "invalid_status_transition", from: market.status, to: "SETTLED" };
    }

    const updatedMarket = await prisma.market.update({
      where: { id: market.id },
      data: {
        status: "SETTLED",
        outcome: input.outcome,
        settlementRef: input.settlementRef
      }
    });

    const positions = await prisma.position.findMany({ where: { marketId: market.id } });
    const payoutEntries = [];

    for (const position of positions) {
      const winningShares = input.outcome ? position.yesShares : position.noShares;
      const grossPayout = winningShares;
      const netPayout = grossPayout + position.cashFlow;

      const payout = await prisma.payout.upsert({
        where: { marketId_userId: { marketId: market.id, userId: position.userId } },
        create: {
          id: `${market.id}:${position.userId}`,
          marketId: market.id,
          userId: position.userId,
          positionId: position.id,
          grossPayout,
          netPayout
        },
        update: {
          grossPayout,
          netPayout,
          status: "PENDING"
        }
      });
      payoutEntries.push(payout);
    }

    return { market: updatedMarket, payouts: payoutEntries };
  });

  app.get("/markets/:id/payouts", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const market = await prisma.market.findUnique({ where: { id: params.id } });

    if (!market) {
      reply.code(404);
      return { error: "market_not_found" };
    }

    const payouts = await prisma.payout.findMany({ where: { marketId: market.id } });
    return { payouts };
  });

  return app;
}
