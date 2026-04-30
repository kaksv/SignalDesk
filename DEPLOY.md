# SignalDesk Deployment Guide (GitHub + Render + Vercel)

## 1) Push project to GitHub

1. Create a new GitHub repository (for example `signaldesk`).
2. In the project root, run:
   - `git init`
   - `git add .`
   - `git commit -m "Initial SignalDesk MVP scaffold"`
   - `git branch -M main`
   - `git remote add origin <your-repo-url>`
   - `git push -u origin main`

## 2) Prepare local environment once

1. API env file:
   - Copy `apps/api/.env.example` to `apps/api/.env`
2. Web env file:
   - Copy `apps/web/.env.example` to `apps/web/.env.local`
3. Install dependencies:
   - `npm install`
4. Local database setup:
   - `npm run db:generate -w @signaldesk/api`
   - `npm run db:migrate -w @signaldesk/api -- --name init`

## 3) Deploy backend to Render

### Option A (recommended): Blueprint deploy with `render.yaml`

1. Go to Render and choose **New +** -> **Blueprint**.
2. Connect your GitHub repo.
3. Render detects `render.yaml` and creates `signaldesk-api` web service.
4. Create a Postgres DB in Render manually (**New +** -> **PostgreSQL**).
5. Copy the DB connection string.
6. In `signaldesk-api` environment variables, set:
   - `DATABASE_URL=<your-render-postgres-connection-string>`
   - Use the **External Database URL** (includes host/user/password/db).
7. Set `CORS_ORIGIN` to your real Vercel URL after frontend deployment.
8. Trigger deploy (or redeploy if already created).

### Option B: Manual Render setup

1. Create a **PostgreSQL** instance.
2. Create a **Web Service** from your repo.
3. Use:
   - Build command: `npm install && npm run db:generate -w @signaldesk/api && npm run build`
   - Start command: `npm run db:deploy -w @signaldesk/api && npm run start -w @signaldesk/api`
4. Add env vars:
   - `DATABASE_URL` (from Render Postgres)
   - `OPERATOR_API_KEY` (long random value)
   - `CORS_ORIGIN` (your Vercel URL)
   - `NODE_ENV=production`

## 4) Deploy frontend to Vercel

1. Import your GitHub repo into Vercel.
2. Set **Root Directory** to `apps/web`.
3. Set env var:
   - `NEXT_PUBLIC_API_URL=https://<your-render-api-domain>`
   - `API_BASE_URL=https://<your-render-api-domain>`
   - `OPERATOR_API_KEY=<same-key-used-by-render-api>`
4. Deploy.

## 5) Wire CORS and redeploy backend

1. Copy your real Vercel domain (for example `https://signaldesk.vercel.app`).
2. In Render service env vars, set:
   - `CORS_ORIGIN=https://signaldesk.vercel.app`
3. Redeploy backend.

## 6) Smoke test in production

1. Check API health:
   - `GET https://<render-domain>/health`
2. Create market (operator-only):
   - `POST /markets` with `x-operator-key`
3. Open market:
   - `PATCH /markets/:id/status` to `OPEN`
4. Place trade:
   - `POST /markets/:id/trades`
5. Close and settle:
   - `PATCH /markets/:id/status` to `CLOSED`
   - `POST /markets/:id/settle`
6. Confirm payouts:
   - `GET /markets/:id/payouts`

## 7) Common gotchas

- Do not use SQLite in production. Use Render Postgres `DATABASE_URL`.
- If you see `Environment variable not found: DATABASE_URL`, the variable is missing at the **service level**. Add it to `signaldesk-api` env vars and redeploy.
- If frontend calls fail with CORS, verify `CORS_ORIGIN` exactly matches your Vercel domain.
- If migrations fail, run `npm run db:deploy -w @signaldesk/api` from Render shell/log retry.
- Keep `OPERATOR_API_KEY` secret and rotate it regularly.
