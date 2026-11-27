# MatchSet

A lightweight PWA for arranging players into balanced teams, sharing links, and keeping a community's match history.

## What it does

### Communities
- Create a community and receive a private organiser token.
- Invite players with a public community link or code.
- Maintain a persistent, community-specific player roster.
- Create matches from roster members; teams are balanced automatically.
- Record one winning team per match.
- View the latest 100 matches and an all-time leaderboard with wins, losses, matches played, and win rate.
- Every player on the winning team receives one win. A match result can only be recorded once.

### Standalone arrangements
- Create a one-off arrangement by entering player names individually.
- Open a read-only share link.
- The creator can edit from the browser/device used to create it.
- Copy or print the full arrangement.
- Group sizes differ by at most one and never exceed the selected maximum.

## Stack

React + TypeScript + Vite, Express, and Neon PostgreSQL. One deployable app; no accounts, queues, microservices, or PlayGeng dependency.

## Important MVP limitations

- Community membership uses display names, not verified accounts. A member can join with a name, but identity is not proven. Do not treat this leaderboard as a verified competition record until account authentication is added.
- The community organiser token and match result tokens are stored in the creator's browser localStorage. Losing that browser storage means losing the corresponding organiser/result permissions.
- Community invite links are public. Anyone with the link can view the roster/history and join with an unused display name.
- The organiser creates matches; the device that created each match records its result. Results are immutable after submission in this MVP.
- Match history displays the latest 100 matches; the leaderboard is calculated across all completed matches.

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

Local development initializes the tables and indexes when the API starts. Production schema is provisioned in Neon separately; Vercel Functions only verify database connectivity and never run DDL on cold starts. The production schema includes the standalone and community tables.

## Deploy to Vercel

The repository exports the Express app from the root `index.ts`. Vercel runs it as a Function, while Vite builds the frontend into `public/` so the CDN serves static assets. Client routes for shared sets and communities are rewritten to the SPA shell.

Set this project environment variable in Vercel for **Production**, **Preview**, and **Development**:

- `DATABASE_URL`: Neon pooled PostgreSQL connection string (include SSL mode).

Do not set `NODE_ENV` manually on Vercel; the platform sets it for deployments. The local-only `PORT` setting is optional. After adding or changing variables, create a new deployment so the function receives them.

## Run locally

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
npm start
```

For a production run, set `NODE_ENV=production` and `PORT` as needed. The Express server serves the built frontend and API from one service.

## PWA

The app includes a web manifest and an installable app shell. The API remains online to load shared arrangements; offline viewing of uncached links is not promised.
