# Frontend audit and redesign direction

**Status:** Audit completed; visual foundation in progress  
**Scope:** React/Vite PWA frontend only. No API, database, authentication, or permission changes.

## Current-state audit

### Structure
- `src/App.tsx` is a single large component containing page state, navigation, API requests, identity flows, community administration, tournament registration, match rotation, and rendering.
- `src/styles.css` is a large global stylesheet with feature styles appended over time. Repeated selectors and responsive overrides make visual changes difficult to reason about.
- Page navigation is implemented with conditional rendering and manual History API calls. Browser back/forward handling needs a dedicated route-state pass.
- UI patterns are not consistently shared: form controls, buttons, panels, menus, status feedback, and tabs have different local implementations.

### UX and content
- The home page is a large editorial hero with several equal-weight action cards. It does not prioritize returning to a community or the live match workflow.
- Community content is useful but the visual hierarchy does not distinguish overview, roster administration, tournament operations, and live match operation strongly enough.
- Match rotation controls and match history share a dense surface. The active game should be visually distinct from completed games.
- Tournament registration is evolving toward explicit per-group team registration. The design must show group ownership and player assignment clearly and prevent accidental duplicate registration.
- Passkey account screens exist, but some copy still describes the product as requiring no account.
- README deployment and account descriptions need reconciliation with the current same-origin API proxy and passkey implementation.

### Accessibility and interaction risks
- Focus-visible treatment is not consistently defined.
- Some tab and menu controls need stronger keyboard and assistive-technology semantics.
- The custom navigation should support browser back/forward, Escape dismissal, and predictable focus handling.
- Empty, loading, error, pending-sync, and success states need a consistent presentation.

## Product design direction: Matchday workspace

MatchSet is an operational tool for arranging and running community football games, not a social feed and not primarily a marketing site.

### Visual system
- Deep charcoal/forest ink for high-contrast actions and match surfaces.
- Restrained pitch-green accent for primary actions and winning states.
- Warm neutral page background and quiet borders for long sessions and outdoor use.
- Manrope for interface typography; tabular numerals for scores, counts, and timers.
- Consistent spacing, radius, elevation, focus, disabled, and status tokens.

### Information architecture
- Home: recently opened communities first; create/join community as primary actions; quick arrangement and quick tournament as secondary tools.
- Community workspace: stable community identity/header, compact summary metrics, consistent section navigation, and role-aware actions.
- Live match: dedicated visual hierarchy for active teams, score, timer, goals, scorer/assist, queue, undo, and game history.
- Tournaments: explicit group -> team -> players structure with registration counts and validation feedback.
- Account: passkey and recovery management using the same component language as the rest of the app.

### Responsive behavior
- Mobile-first, touch-sized controls and compact vertical rhythm.
- Avoid nested independently scrolling panels. Let document content grow naturally except for deliberate, bounded controls such as menus.
- Keep the live score and primary match actions visible without forcing users through unrelated information.
- Desktop may use more horizontal space, but must retain the same hierarchy and workflows.

## Implementation plan

1. **Visual foundation:** centralize design tokens and apply a consistent baseline to the existing screens without changing behavior.
2. **Shared UI primitives:** extract buttons, fields, panels, tabs, status messages, and navigation into reusable components.
3. **Navigation and shell:** replace fragile ad-hoc page transitions with route-aware navigation that handles browser history.
4. **Community and match workflows:** redesign the community workspace and make active match operation a distinct experience.
5. **Tournament and account flows:** align explicit group registration and passkey/recovery screens with the shared system.
6. **Validation:** run typecheck, tests, and production build; review mobile widths, keyboard focus, loading/error/empty states, and existing API contracts.

## Non-negotiable compatibility constraints
- Do not change backend endpoints or payload shapes as part of visual work.
- Do not weaken owner/admin/viewer boundaries.
- Preserve existing owner/admin capabilities and legacy access during identity rollout.
- Do not store email addresses, recovery codes, passkey private material, or session secrets in the frontend.
- Do not introduce production database migrations for a frontend redesign.
- Keep offline status explicit; never imply a pending local action is server-synced.
- Incorporate the open group-based tournament registration work rather than reverting it.
