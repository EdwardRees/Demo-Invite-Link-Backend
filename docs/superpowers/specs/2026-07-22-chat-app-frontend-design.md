# Chat App Frontend — Design Spec

Date: 2026-07-22
Status: Approved

## Goal

Build out the `ui/` SvelteKit skeleton into a functional, minimal chat app that
exercises the full backend journey already implemented in the parent Elysia
server: signup/login, creating or joining a group via an invite link, and
real-time chat within a group.

## Backend surface being consumed

Base URL: `http://localhost:3000` (Elysia, port 3000, no current CORS support).

| Method | Path | Auth | Body / Params | Notes |
|---|---|---|---|---|
| POST | `/auth/signup` | — | `{email, password}` | Sets `x-refresh-token` httpOnly cookie, returns `{"x-access-token"}` |
| POST | `/auth/login` | — | `{email, password}` | Same shape as signup |
| POST | `/auth/refresh` | refresh cookie | — | Returns a new `{"x-access-token"}`, rotates the cookie |
| POST | `/users` | header `x-access-token` | `{name}` | Creates the profile row for the authenticated id; 409 if it already exists |
| GET | `/users/:id` | — | — | Returns the profile row (or `undefined` if none) |
| GET | `/belonging` | header `x-access-token` | — | Groups the current user belongs to (owned groups included, since the owner is auto-added as a member) |
| POST | `/groups` | header `x-access-token` | `{name}` | Creates a group, auto-adds owner as member; 409 on duplicate name for that owner |
| GET | `/groups` | header `x-access-token` | — | Groups owned by the current user (not used by the frontend — `/belonging` covers what's needed) |
| POST | `/invite` | header `x-access-token` | `{target_user_id: number, group_id: number}` | Owner-only (403 otherwise); returns `{data: "/join/<token>"}` |
| POST | `/join/:token` | header `x-access-token` | — | Redeems an invite token; 409 if already a member |
| WS | `/ws/:groupId` | query `x-access-token` | send `{text}` | On open: `{type: 'history', messages: [{userId, text, ts}]}`. On message: broadcasts `{type: 'message', userId, text, ts}` |

Known backend quirks accepted as-is (not fixed as part of this work):
- No logout/token-revocation endpoint.
- No user search/lookup by name — only by numeric id.
- Chat auth is via query string (`x-access-token`), inconsistent with the header-based auth used everywhere else, because WebSocket upgrade requests can't carry custom headers from the browser.

## Backend change required

The backend currently sends no CORS headers, and the SvelteKit dev server runs
on a different origin/port. Browser `fetch` calls need CORS, and because the
refresh flow depends on an httpOnly cookie, credentialed CORS is required
(explicit origin, not `*`).

- Add `@elysiajs/cors` as a backend dependency.
- In `src/index.ts`, wire `.use(cors({ origin: 'http://localhost:5173', credentials: true }))`.
- This is the only backend file touched by this work.

## Frontend configuration

- `ui/.env`: `PUBLIC_API_URL=http://localhost:3000`, read via `$env/static/public`.
- The WebSocket base is derived from `PUBLIC_API_URL` by swapping the `http`
  scheme for `ws` (`http`→`ws`, `https`→`wss`).

## Routing

Client-rendered app: `export const ssr = false` in the root `+layout.ts`,
since auth state lives in `localStorage` and every page needs live data
(WebSocket, freshly-fetched groups).

```
src/routes/
  +page.svelte                         landing (exists) — CTA to /login /signup; auto-redirect to /groups if a token is present
  login/+page.svelte
  signup/+page.svelte                  email + password + display name in one form
  complete-profile/+page.svelte        fallback: name-only form, used if login finds no profile row
  (app)/+layout.svelte                 auth guard (redirect to /login if no token) + nav bar with logout
  (app)/groups/+page.svelte            list "my groups" (GET /belonging) + create-group form (POST /groups)
  (app)/groups/[id]/+page.svelte       group detail: invite panel (target user id → POST /invite → shows the /join/<token> link), link into chat
  (app)/groups/[id]/chat/+page.svelte  chat room (WebSocket)
  (app)/join/[token]/+page.svelte      redeems an invite (POST /join/:token), then redirects into the group
```

## Modules

- `src/lib/api.ts` — fetch wrapper. Attaches `x-access-token` header,
  `credentials: 'include'`. On a 401, calls `POST /auth/refresh` once and
  retries the original request; if that also fails, clears local auth state
  and redirects to `/login`.
- `src/lib/auth.svelte.ts` — Svelte 5 runes-based reactive auth state (access
  token + user id decoded from the JWT `sub` claim — a plain base64 payload
  decode for display purposes, not a verification), persisted to
  `localStorage`.
- `src/lib/ws.ts` — small helper to build the chat WebSocket URL and wrap
  `send`/`onmessage` handling for the two message types (`history`,
  `message`).

## Auth flow

- **Signup**: submit email/password/display name → `POST /auth/signup` → on
  success, immediately `POST /users {name}` to create the profile → store the
  access token → navigate to `/groups`.
- **Login**: submit email/password → `POST /auth/login` → store the access
  token → `GET /users/:id` (id from the decoded token) to confirm a profile
  exists. If not found, navigate to `/complete-profile` (name-only form →
  `POST /users`) before continuing to `/groups`.
- **Session bootstrap**: on app load, if a token exists in `localStorage`, use
  it optimistically; any 401 from `api.ts` triggers the refresh-and-retry path
  described above.
- **Logout**: client-only — clear the local token, navigate to `/`. The
  refresh cookie is not revoked server-side (no such endpoint exists); this is
  an accepted limitation for this demo.

## Groups & invites

- `/groups`: fetch `GET /belonging`, render as a list of links to
  `/groups/[id]`. A form posts `POST /groups {name}`, then refetches the
  list. Surface 409 (duplicate name) as an inline error.
- `/groups/[id]`: shows group name/id, a link into `/groups/[id]/chat`, and an
  invite panel — a numeric input for the target user id, submitted as
  `POST /invite {target_user_id, group_id}`. Ownership isn't pre-checked
  client-side (no extra request); a 403 from the backend is shown inline as
  "Not the group owner." On success, render the returned `/join/<token>` path
  as a copyable absolute URL (`${origin}${path}`).
- `/join/[token]`: on mount, `POST /join/:token`. On success (201) or on 409
  (already a member), redirect to `/groups/[id]` using the group id echoed
  back in the response. On other errors (400 invalid token, 401), show the
  message with a link back to `/groups`.

## Chat room

- On mount, open `${WS_BASE}/ws/${groupId}?x-access-token=${token}`.
- `{type: 'history', messages}` seeds the message list (already newest-last
  per the backend's `orderBy(asc(...))`).
- `{type: 'message', userId, text, ts}` appends a live message.
- Sending: `ws.send(JSON.stringify({text}))` on form submit; clear the input
  optimistically.
- Display names: no bulk-lookup endpoint exists, so names are resolved
  lazily — the first time a `userId` appears, `GET /users/:id` is fetched
  once and cached in a `Map<number, string>` for the session; until resolved,
  show `User #<id>`.
- Own messages (`userId` matches the decoded token subject) are visually
  distinguished (right-aligned) from others (left-aligned).
- On socket `close`/`error`, show a small "disconnected" indicator. No
  auto-reconnect in v1 — keep it simple; the user can reload the page.

## Error handling

- All form submissions show inline error text near the field/action, sourced
  from the backend's status text/body where available.
- The `(app)` layout guard redirects unauthenticated users to `/login`, and
  the refresh-and-retry logic in `api.ts` is the single place 401s are
  handled, so individual pages don't need bespoke 401 handling.

## Styling

Minimal, functional Tailwind styling consistent with the existing dark
landing page (slate palette, centered layouts, existing `@tailwindcss/forms`
plugin for form controls). No new design system work.

## Out of scope

- Fixing backend logic bugs unrelated to CORS (e.g. `GET /groups/:id`'s
  response shape, the dead `hashed_password` computation in `/auth/login`).
- Logout/token revocation on the backend.
- User search by name, group membership management (removing members),
  message editing/deletion, typing indicators, read receipts.
- WebSocket auto-reconnect, offline support, mobile-specific layout work.
- Automated end-to-end tests (manual verification only, per project size).

## Testing approach

Manual verification against a running backend (`bun dev` in the parent
directory) and frontend (`bun run dev` in `ui/`):
1. Sign up a new user → profile created → lands on `/groups`.
2. Create a group → appears in the list.
3. Generate an invite for a second (separately signed-up) user's id → copy the
   `/join/<token>` link.
4. Log in as the second user, visit the join link → redirected into the
   group.
5. Open chat as both users in two browser sessions → messages appear live in
   both, and history reloads correctly on refresh.
6. Log out and confirm the `(app)` routes redirect to `/login`.
