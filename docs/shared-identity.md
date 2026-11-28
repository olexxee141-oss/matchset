# Shared identity and community membership

Status: approved product direction; implementation not yet enabled.

## Decision

MatchSet will introduce a lightweight shared account. A person has one global identity and may hold independent memberships in multiple communities. Community membership is the source of community-scoped display names, status, and permissions.

Authentication will use passkeys as the normal sign-in method, with a one-time recovery code as the account recovery factor. MatchSet will not retain users' email addresses.

## Identity invariants

- A global user has a stable opaque `user_id`; it is never a display name or email address.
- A user can belong to many communities.
- Each community membership has its own stable `membership_id`, display name, status, and community-scoped role.
- Display names are not unique and must never be used as foreign keys, authorization subjects, or leaderboard aggregation keys.
- The same user may use different display names in different communities.
- A role in one community grants no permissions in another.
- Match participation, goals, assists, leaderboard rows, and audit records must resolve through stable membership IDs.
- Existing unclaimed roster rows must not be linked to an account by matching names or email guesses.

## Authentication and recovery

- Passkeys (WebAuthn) are the normal account sign-in method. Store only the credential public key and required credential metadata; never store a passkey private key.
- A user may register more than one passkey, so losing one device does not automatically lock them out.
- At account creation, generate a high-entropy, single-use recovery code. Show it once and require the user to save it before finishing setup.
- Store only a strong hash of the recovery code. Never log it, return it again, or store it in plaintext.
- Recovery requires the recovery code plus an email address supplied at the time of recovery. Send a short-lived, single-use verification link to that address; the address is a delivery destination only, not an account identifier.
- Do not persist the supplied email address in the user profile, login identity table, or permanent audit metadata. Avoid retaining it in application logs, analytics, or error traces. The recovery request should store only a challenge hash, expiry, attempt limits, and the account reference; email delivery happens immediately through a provider adapter.
- After successful recovery, require the user to register a new passkey and issue a replacement recovery code. Revoke existing sessions and allow the user to review/revoke old passkeys.
- Email by itself cannot identify or recover an account. If both all passkeys and the recovery code are lost, the user cannot use email alone to prove account ownership. A separate community-governance recovery process must be designed before launch; it must not silently grant account access.
- No password login, persistent email login, KYC, social login, or mandatory profile completion in the initial release.
- Sessions must be revocable and stored in secure, HttpOnly, SameSite cookies where the deployment topology permits. Do not persist bearer credentials in localStorage.

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
2. Add additive global users, passkey credentials, recovery challenges, sessions, memberships, and claim-invitation schema. Do not add a persistent email identity table.
3. Implement WebAuthn registration/authentication, secure session lifecycle, recovery-code issuance and hashing, one-time email delivery for recovery, CSRF protection where cookie auth is used, and rate limits.
4. Add authenticated My Communities and invite-based joining.
5. Add owner-initiated roster claim flow and owner account claiming.
6. Migrate authorization to account + membership IDs; keep legacy credentials during a measured compatibility window.
7. Remove legacy access only after every existing community has a verified owner and tested recovery path.

## Security and acceptance criteria

- Every private mutation is authorized on the server using a verified session and a membership/role scoped to the requested community.
- Public community links remain read-only.
- Duplicate display names are supported in the same community.
- One account can have multiple memberships and different names/roles in each.
- Revoking a membership or role takes effect on the next server request.
- Passkey challenge origin/RP ID, expiry, one-time use, signature verification, and replay protections are tested.
- Recovery code entropy, one-time use, hashing, attempt limits, email-link expiry, replay protection, session revocation, and recovery rate limits are tested.
- No persistent email address is stored. Email supplied for recovery is transient delivery input only and must not enter logs or analytics.
- No raw recovery code, challenge token, session secret, or legacy organiser token is logged.
- No production migration or deployment occurs until migration tests, CI, and the email delivery provider configuration are verified.

## Explicit non-goals

No KYC, wallet/payment feature, social feed, public follower graph, persistent email identity, or cross-community role inheritance.
