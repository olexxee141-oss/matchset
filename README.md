# MatchSet

A lightweight PWA for arranging players into balanced teams, sharing links, and keeping a community's match history.

## What it does

### Communities
- Create a community and receive a private organiser token.
- Share a public, read-only community link with invitees.
- The creator maintains the persistent, community-specific player roster; invitees cannot add or edit players.
- Create matches from roster members; teams are balanced automatically.
- Start each community match with Set 1 vs Set 2, then rotate using winner-stays rules: winner stays, loser joins the back of the queue; after a draw both teams join the back and the next two teams enter.
- Record every game (wins and draws), view the waiting queue and game history, and undo the latest result.
- View the latest 100 matches and an all-time leaderboard with wins, losses, matches played, and win rate.
- Every player on the winning team receives one win. A match result can only be recorded once.

### Standalone arrangements
- Create a one-off arrangement by entering player names individually.
- Open a read-only share link.
- The creator can edit from the browser/device used to create it.
- Copy or print the full arrangement.
- Group sizes differ by at most one and never exceed the selected maximum.

## Stack

React + TypeScript + Vite, Express, and Neon PostgreSQL. One lightweight frontend and API; no account system, microservices, or PlayGeng dependency.

## Important MVP limitations

- The creator enters player display names; these are not verified identities. Do not treat this leaderboard as a verified competition record until account authentication is added.
- Invite links are read-only. Only the creator's organiser token can add roster members or create matches.
- The community organiser token and match result tokens are stored in the creator's browser localStorage. Losing that browser storage means losing the corresponding organiser/result permissions.
- Community invite links are public. Anyone with the link can view the roster, leaderboard and match history, but cannot modify community data.
- The organiser creates matches; the device that created each match records rotation results and can undo the latest result. Rotation state and game history are stored in the backend.
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

## Deployment

The frontend and API are deployed separately:

- **Frontend:** Vercel (React + Vite static site).
- **API:** Render (Express web service).
- **Database:** Neon PostgreSQL.

### Render API environment

Configure these on the Render API service:

- `DATABASE_URL`: Neon pooled PostgreSQL connection string (include `sslmode=require`).
- `FRONTEND_ORIGIN`: the exact deployed frontend origin, e.g. `https://matchset-teal.vercel.app`.
- `NODE_ENV`: `production` (set by the Render Blueprint).
- `PORT`: supplied automatically by Render; do not hardcode it.

The API health endpoint is `/api/health`. The Render free service may sleep when idle, so the first request after inactivity can take longer.

### Vercel frontend environment

Configure this variable for **Production**, **Preview**, and **Development**:

- `VITE_API_BASE_URL`: the Render API origin, e.g. `https://matchset-backend.onrender.com` (no trailing slash).

Vite embeds `VITE_*` variables at build time. Redeploy the frontend after adding or changing this variable. Do not put `DATABASE_URL` in the Vercel frontend project.

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

For a local production-mode run, set `NODE_ENV=production` and `PORT` as needed. Vercel serves the built frontend from its static CDN and runs the Express API as a Function.

## PWA

The app includes a web manifest and an installable app shell. The API remains online to load shared arrangements; offline viewing of uncached links is not promised.


## Communities, Admins and tournaments

- **My Communities** keeps up to 12 recently opened communities in the current browser so users can return without finding the invite link again. This is device-local history, not account-based membership sync; clearing browser data or changing devices removes this shortcut.
- Community owners can promote roster members to **Admin** and revoke that role later.
- Admins can create tournaments, distribute teams across groups, and move teams between groups. They cannot manage the roster, appoint admins, create regular matches, or record match results.
- Admin access is currently delivered through a private bearer link because MatchSet does not yet require user accounts. Share it only with the intended member; demoting that member revokes the token.
- Tournament data and role changes are persisted in Neon. The backend migration is maintained in [MatchSet-backend](https://github.com/olexxee141-oss/Matchset-backend/tree/main/docs/migrations).
