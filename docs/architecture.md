# SignalDesk Architecture

## Product Name

**SignalDesk** - institutional prediction markets for policy, macro, credit, and operations-linked events.

## Core modules

1. **Market Registry**
   - Creates markets with outcome definitions, close times, and settlement rules.
   - Restricts creation rights to approved operators for MVP.
2. **Liquidity Engine**
   - Uses a simple binary AMM/LMSR-like pricing module for MVP.
   - Supports fee configuration and risk caps per market.
3. **Order and Position Ledger**
   - Records buys/sells and net participant exposures.
   - Handles limit checks (max notional, participation policy).
4. **Settlement Engine**
   - Ingests resolved outcomes from trusted oracle operators.
   - Computes payouts and emits redemption claims.
5. **Canton Connector (phase 2 integration)**
   - Syncs collateral movement and settlement events with Canton-based asset rails.
   - Handles participant identity mapping and permission checks.

## Data and event flow

1. Operator creates a market.
2. Liquidity provider seeds initial depth.
3. Traders open or close positions.
4. Risk module validates each trade.
5. Market closes at expiry.
6. Outcome is posted and verified.
7. Settlement engine computes claims.
8. Claims redeem into collateral balances and activity metrics.

## Recommended technologies

- **Backend API**: Node.js + TypeScript + Fastify.
- **UI**: Next.js (App Router) + Tailwind CSS + shadcn/ui.
- **Shared contracts**: `zod` schemas in a shared package.
- **Database**: PostgreSQL with Prisma.
- **Caching/queues**: Redis + BullMQ for settlement jobs.
- **Observability**: OpenTelemetry + Grafana/Tempo/Loki.
- **AuthN/AuthZ**: OIDC (Auth0/Okta) + role-based policies.
- **Infra**: Docker Compose for local dev; Kubernetes for staging/prod.

## Why this stack

- Fast iteration speed with TypeScript end-to-end.
- Clear boundary between product logic and Canton integration adapters.
- Easy to test market math and event flows locally before network integration.
- Production-ready path for institutional reliability requirements.

## MVP scope (first build cycle)

- Binary markets only (YES/NO).
- Operator-created markets only.
- Simulated settlement oracle endpoint (manually triggered).
- In-app collateral ledger abstraction (ready to map to Canton assets later).
- Activity dashboard: active traders, volume, open interest, settled markets.
