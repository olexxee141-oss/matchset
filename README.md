# MatchSet

A lightweight PWA for arranging players into balanced groups and sharing one read-only link.

## What it does

- **Create a set:** enter an arrangement name, paste player names (one per line), choose the maximum players per set, and generate.
- **View a set:** open the shared URL. Viewers do not need accounts.
- **Creator edits:** the creator can edit from the browser/device used to create the arrangement. Viewers remain read-only.
- **Balanced distribution:** every player is included; group sizes differ by at most one and never exceed the selected maximum.

## Stack

React + TypeScript + Vite, Express, and Neon PostgreSQL. One deployable app; no accounts, queues, microservices, or PlayGeng dependency.

## Neon setup

The project is already provisioned in Neon:

- Organization: `org-falling-block-14904006`
- Project: `late-cell-54980476`
- Branch: `production`
- Database: `neondb`

On a machine with Node.js 20+ and access to the Neon account:

```bash
npm install
npm i -g neon@latest
neon init -y --org-id org-falling-block-14904006 --project-id late-cell-54980476 --branch production --services postgres
neon deploy
```

If global installation is blocked, use `npx neon@latest` for the Neon commands. If the CLI opens a browser sign-in, finish signing in there and rerun the command. If sign-in times out, run `neon login` and retry.

Neon CLI pulls `DATABASE_URL` into `.env` if it exists, otherwise `.env.local`. Both are ignored by Git. The server loads either file automatically. Keep the pooled `DATABASE_URL` for application traffic; use `DATABASE_URL_UNPOOLED` only for schema migrations and administrative work.

Postgres is built into every Neon project. `neon.ts` intentionally declares no additional services: this app does not need Neon Auth, Object Storage, Functions, or the Data API.

## Run locally

```bash
npm install
npm run dev
```

The Vite app runs at http://localhost:5173 and proxies API requests to http://localhost:4000. The API creates the `match_sessions` table at startup if it does not exist.

## Checks

```bash
npm run typecheck
npm test
npm run build
npm start
```

For a production run, set `NODE_ENV=production` and `PORT` as needed. The Express server serves the built frontend and API from one service.

## PWA

The app includes a web manifest and an installable app shell. The API remains online to load shared arrangements; offline viewing of uncached links is not promised.
