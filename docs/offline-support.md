# MatchSet Offline Support — Product and Frontend Plan

**Status:** Decision documented; implementation not started.  
**Scope:** MatchSet PWA in `olexxee141-oss/matchset`, coordinated with the [backend plan](https://github.com/olexxee141-oss/Matchset-backend/blob/main/docs/offline-support.md).

## Product decision

MatchSet should become useful during a real football session even when mobile data or Wi-Fi is unavailable. Offline support is not just an offline landing page: the organiser must be able to continue a previously loaded community session, record game events, and synchronise them when connectivity returns.

This document records the agreed direction. It does not claim that offline support currently exists.

## Current product baseline

- React + TypeScript + Vite PWA frontend; Express API; Neon PostgreSQL.
- Communities, persistent rosters, community match history, leaderboard, tournament grouping, and private organiser/admin bearer links.
- Winner-stays rotation: begin with Set 1 vs Set 2; a winner stays while the losing team moves to the back of the queue; on a draw both active teams move to the back and the next two enter.
- Goal target is configurable from 1–5 (default 1); game duration is configurable from 1–60 minutes (default 10).
- Goals record the scoring team, scorer, and optional assister. Reaching the target completes the game.
- Timer expiry selects the higher-scoring team or a draw when scores are tied. Organisers can pause/resume and undo the latest completed game.
- Match rotation state and history are persisted in backend JSONB. Neon production DDL is managed separately; the API must not run schema changes on startup.
- There are no user accounts. Organiser and admin bearer links are sensitive capabilities.
- Current README describes an installable PWA, but does not establish that a service worker, durable offline cache, or offline write queue is implemented. Verify the actual code before treating any offline capability as available.

## Intended offline behaviour

| Capability | Offline expectation |
|---|---|
| Previously opened community | Open from locally cached data |
| Roster, leaderboard, match history | Read the last successfully synchronised snapshot |
| Previously loaded tournament groups | Read cached groups; no promise for uncached data |
| Start a match | Allow only when the required community and roster data are cached; mark pending |
| Record goal / scorer / assist | Queue locally and show as pending synchronisation |
| Winner-stays transition | Apply optimistically from the local event stream; show pending status |
| Pause / resume / timer expiry | Preserve timer state and queue the organiser action/event; never reset the clock on reconnect |
| Undo latest completed game | Queue only when the local event history proves which event is being undone; server validates before acceptance |
| New community / roster / admin actions | Not part of the first offline release; require a live server unless separately specified |

Offline changes are provisional until the server acknowledges them. The UI must distinguish **Saved on this device**, **Sync pending**, **Synced**, and **Sync failed / needs attention**. Do not present a locally queued result as a confirmed server record.

## Frontend architecture

### 1. PWA shell

- Inspect the existing manifest and build setup before adding a service worker.
- Add a service worker to cache the static app shell and versioned assets.
- Provide an offline fallback and a clear update lifecycle.
- Never use a broad cache-first strategy for API responses, bearer-token requests, or private organiser/admin capabilities.
- Do not cache secrets or treat a cached response as proof that a capability is still valid.

### 2. Durable local data

Use IndexedDB (not localStorage) for structured offline data:

- Last-known community snapshot and roster.
- Cached match and tournament read models.
- Active rotation session snapshot.
- Ordered pending-operation/event queue.
- Sync metadata, retry state, and last acknowledged server version.

Keep the existing localStorage token behaviour only where required for current compatibility; do not copy bearer tokens into general-purpose caches, logs, event payloads, or diagnostics. Evaluate token storage separately before changing it.

### 3. Event queue

Each locally created operation should include:

- Globally unique `operationId` generated once and retained across retries.
- `communityId`, `matchId`, and session identifier.
- Monotonic client sequence within that match session.
- Event type and validated payload.
- Expected server/session version observed by the client.
- Client-created timestamp for diagnostics, not as trusted proof of elapsed time.
- Sync status and server acknowledgement.

Preserve original event order. Retry with the same operation ID. Never create a new ID just because a request timed out.

### 4. Sync lifecycle

1. Load the last acknowledged server snapshot from IndexedDB.
2. Apply new local actions to a local projection and append them to the durable queue in one IndexedDB transaction.
3. When online, submit queued operations in order.
4. Server acknowledges accepted operations and returns the authoritative state/version.
5. Mark acknowledged operations as synced and refresh the local snapshot.
6. On rejection or version conflict, retain the unsynced operation and show a recoverable conflict state. Do not silently discard it or overwrite server state.

The frontend must tolerate app closure, browser restart, device sleep, duplicate network delivery, and intermittent connectivity.

## Timer policy and hard limitation

The backend is authoritative while online. A fully disconnected device cannot obtain trusted server time continuously. Therefore an offline timer can be operationally useful, but cannot be described as tamper-proof or strongly server-authoritative.

- Persist the timer's original start/resume/pause facts and remaining duration; reconnecting must never reset or extend it.
- Use a monotonic elapsed-time source while the page is running. Persist wall-clock anchors only as recovery hints across reloads.
- Detect suspicious clock discontinuities and avoid silently manufacturing a precise expiry time after a restart.
- If the timer expires offline, display the outcome as **provisional / pending sync**.
- The server must validate the event against the last accepted timer state and an explicit policy for offline elapsed time. If the evidence is insufficient, require organiser resolution rather than silently accepting a fabricated timestamp.
- Do not claim server-authoritative expiry while the client is disconnected.

## Concurrency and conflict policy

Initial offline release supports one controlling organiser device per match session. Two devices editing the same session while disconnected create an unsafe merge problem.

- A match event is accepted only once.
- Events must be in valid sequence and based on the expected session version.
- A stale version or invalid transition is rejected with the authoritative current state.
- A conflict must preserve the local unsynced log for recovery/export or explicit resolution.
- No last-write-wins overwrite for scores, queue positions, goals, timer state, or undo.
- Multi-device offline editing is explicitly out of scope until a conflict-resolution model is designed.

## Security and privacy

- Do not cache organiser/admin bearer endpoints or token-bearing API responses in the service worker.
- Do not include bearer tokens in queued event bodies unless the API contract requires the existing authorisation mechanism; transmit credentials through the established secure request mechanism.
- Keep public community snapshots separate from privileged actions.
- A cached community is a stale snapshot, not proof that the user still has current organiser/admin permission.
- Clear or invalidate local privileged state when the owner revokes a token and the client next reconnects.
- Avoid logging credentials, full token-bearing URLs, or private payloads.

## Delivery phases

1. **Audit current PWA:** confirm manifest, service-worker registration, cache rules, browser support, token storage, and current API request patterns.
2. **Offline read baseline:** service worker app-shell caching and IndexedDB snapshots for previously opened communities.
3. **Offline status UX:** online/offline indicator, last-sync time, pending count, per-operation status, and visible failure recovery.
4. **Event queue:** durable, ordered local operations for match creation and rotation events (goals, assists, pause/resume, result/expiry, undo).
5. **Backend protocol:** idempotency, session versioning, transactional event validation, acknowledgement, and conflict responses. See backend plan.
6. **Hardening:** retry/backoff, app restart recovery, storage quota handling, schema/version upgrades for IndexedDB, and explicit recovery path for rejected events.
7. **Release testing:** airplane mode, reconnect, duplicate requests, browser restart, device clock changes, expired/revoked token, two-device contention, and network failure during acknowledgement.

## Acceptance criteria

- A previously synchronised community can be reopened with no network.
- Cached roster and match history are clearly labelled with their last-sync time.
- Organiser can record an offline goal and see it persist after closing and reopening the app.
- A queued event is transmitted once logically even if the HTTP request is retried many times.
- Reconnect does not reset or extend an active timer.
- Offline game outcomes remain visibly provisional until accepted by the server.
- A conflicting or rejected event is never silently lost.
- Two offline organisers cannot silently overwrite one another.
- No bearer token or privileged API response is added to a generic service-worker cache.

## Out of scope for the first release

- Offline account creation/authentication (the product currently has no account system).
- Multi-device concurrent offline editing.
- Offline roster management, role changes, or tournament administration.
- Guaranteed timer fairness against a device owner changing system time.
- Background sync guarantees on every mobile browser; foreground retry on app reopen must remain available.

## Related documentation

- [Backend offline protocol and API requirements](https://github.com/olexxee141-oss/Matchset-backend/blob/main/docs/offline-support.md)
- [Backend API contract](https://github.com/olexxee141-oss/Matchset-backend/blob/main/docs/api-contract.md)
