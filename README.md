# SignalDesk

SignalDesk is a privacy-aware, institution-friendly prediction market built for the Canton ecosystem.

## Why this product

- Demonstrates real market activity (market creation, liquidity, trading, settlement).
- Fits Canton strengths: selective privacy, compliance workflows, and cross-app synchronization.
- Starts with a focused MVP and grows into institutional collateral-aware market infrastructure.

## Milestones

- Milestone 1: API + domain models for market lifecycle.
- Milestone 2: Trading and settlement simulation.
- Milestone 3: Canton connector and collateral adapter.
- Milestone 4: Frontend trading console and admin market operations.
- Milestone 5: Devnet-style integration testing and GTM pilot metrics dashboard.

## Monorepo structure

- `apps/api` - market engine and API services.
- `apps/web` - operator and trader web UI.
- `packages/shared` - shared domain types and validation schemas.
- `.superstack/build-context.md` - build phase context and milestone status.
- `docs/architecture.md` - system architecture and technology choices.
- `DEPLOY.md` - step-by-step GitHub + Render + Vercel deployment runbook.
