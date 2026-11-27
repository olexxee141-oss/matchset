# MatchSet

A lightweight PWA for arranging players into balanced groups and sharing one read-only link.

## What it does

- **Create a set:** enter an arrangement name, paste player names (one per line), choose the maximum players per set, and generate.
- **View a set:** open the shared URL. Viewers do not need accounts.
- **Creator edits:** the creator can edit from the browser/device used to create the arrangement. Viewers remain read-only.
- **Balanced distribution:** every player is included; group sizes differ by at most one and never exceed the selected maximum.

## Stack

React + TypeScript + Vite, Express, PostgreSQL. One deployable app; no accounts, queues, microservices, or PlayGeng dependency.

## Run locally

1. Install Node.js 20+ and PostgreSQL.
2. Create a database named `matchset`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL`.
4. Run:

```bash
npm install
npm run dev
```

The Vite app runs at http://localhost:5173 and proxies API requests to http://localhost:4000.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Production

Set `DATABASE_URL`, `NODE_ENV=production`, and optionally `PORT`. Run `npm run build` then `npm start`. The Express server serves the built frontend and API from one service. Use a managed PostgreSQL instance; the app creates its small table at startup.

## PWA

The app includes a web manifest and an installable app shell. The API remains online to load shared arrangements; offline viewing of uncached links is not promised.
