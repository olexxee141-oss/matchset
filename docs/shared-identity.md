# Shared identity and community membership

Status: approved product direction; implementation not yet enabled.

## Decision

MatchSet will introduce a lightweight shared account. A person has one global identity and may hold independent memberships in multiple communities. Community membership is the source of community-scoped display names, status, and permissions.

## Identity invariants

- A global user has a stable opaque `user_id`; email is a verified login identifier, not a public identifier.
- A user can belong to many communities.
- Each community membership has its own stable `membership_id`, display name, status, and community-scoped role.
- Display names are not unique and must never be used as foreign keys, authorization subjects, or leaderboard aggregation keys.
- The same user may use different display names in different communities.
- A role in one community grants no permissions in another.
- Match participation, goals, assists, leaderboard rows, and audit records must resolve through stable membership IDs.
- Existing unclaimed roster rows must not be linked to an account by matching names or email guesses.

## Authentication experience

- Passwordless email sign-in with verified email.
- Keep onboarding minimal: authenticate, then join/create a community or claim an existing membership.
- No KYC, social graph, public profile requirement, or mandatory profile completion.
- Sessions must be revocable and stored in secure, HttpOnly, SameSite cookies where the deployment topology permits. Do not persist bearer credentials in localStorage.
- Email delivery configuration is a deployment prerequisite. Authentication must fail closed when verification is unavailable.

## Community navigation

- Authenticated users get a server-backed **My Communities** list across devices.
- Retain a local cache for fast startup/offline read-only access; the server remains authoritative.
- Joining through an invite link adds a membership to the signed-in account after authentication.
- A user can leave a community without deleting their global account or other memberships.

## Existing data and migration

- Preserve existing community IDs, roster rows, match IDs, rotation JSON, tournament records, and historical statistics.
- Existing roster rows become unclaimed membership candidates. Do not merge same-name rows.
- A claim requires a community-controlled proof flow: owner/admin issues a single-use, expiring claim invitation tied to the exact roster row; the claimant authenticates and accepts it. Record issuer, claimant, timestamps, and result.
- Existing owner and admin bearer credentials remain supported during a staged transition. Each privileged community must be explicitly claimed by its current owner using the existing credential before privileges are attached to an account.
- Never infer ownership from a display name, email address, browser localStorage, or possession of a public community link.
- Keep a rollback path and test migration against a disposable database copy before production.

## Delivery phases

1. Audit current schema, route authorization, token issuance/storage, match/goal/assist identity references, and frontend local storage.
2. Add additive global users, verified login identities, sessions, memberships, and claim-invitation schema. No destructive migration.
3. Implement passwordless verification, secure session lifecycle, CSRF protection where cookie auth is used, rate limits, and account recovery.
4. Add authenticated My Communities and invite-based joining.
5. Add owner-initiated roster claim flow and owner account claiming.
6. Migrate authorization to account + membership IDs; keep legacy credentials during a measured compatibility window.
7. Remove legacy access only after every existing community has a verified owner and recovery path.

## Security and acceptance criteria

- Every private mutation is authorized on the server using a verified session and a membership/role scoped to the requested community.
- Public community links remain read-only.
- Duplicate display names are supported in the same community.
- One account can have multiple memberships and different names/roles in each.
- Revoking a membership or role takes effect on the next server request.
- Session rotation, logout, global session revocation, email verification expiry, replay protection, and rate limiting are tested.
- No raw login token, session secret, or legacy organiser token is logged.
- No production migration or deployment occurs until migration tests, CI, and the email provider configuration are verified.

## Explicit non-goals

No KYC, wallet/payment feature, social feed, public follower graph, or cross-community role inheritance.
