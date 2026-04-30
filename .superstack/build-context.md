# Build Context

phase: build
project:
  name: SignalDesk
  category: institutional prediction market
  one_liner: Privacy-aware event markets for regulated participants on Canton.
architecture:
  style: modular monorepo
  apps:
    - api (Fastify + TypeScript)
    - web (Next.js + TypeScript + Tailwind)
  shared:
    - domain types and schemas
build_status:
  milestones:
    - name: "Foundation scaffolding and architecture"
      status: completed
    - name: "Market lifecycle API"
      status: completed
    - name: "Trade and settlement engine"
      status: completed
    - name: "Canton connector and collateral adapter"
      status: pending
    - name: "Pilot UI and analytics"
      status: pending
  mvp_complete: false
  tests_passing: true
  devnet_deployed: false
