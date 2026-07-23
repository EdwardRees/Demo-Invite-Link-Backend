# Chat App Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `ui/` SvelteKit skeleton into a working chat app (signup/login → create or join a group via an invite link → real-time chat) wired against the existing Elysia backend in the parent directory.

**Architecture:** A client-rendered SvelteKit app (SSR off) with a small set of framework-agnostic `src/lib/*.ts` modules (JWT decode, API client with 401-refresh-retry, WebSocket helpers) backing Svelte 5 runes pages. The only backend change is adding CORS support so the browser can call it from a different origin/port.

**Tech Stack:** SvelteKit 2 (Svelte 5, runes mode), Tailwind v4, Bun (runtime, package manager, and `bun test` for pure-logic unit tests), Elysia (backend, unchanged except CORS).

## Global Constraints

- Backend runs at `http://localhost:3000` (Elysia/Bun); frontend dev server at `http://localhost:5173` (SvelteKit/Vite default).
- Access token header name is exactly `x-access-token` (must match the backend's casing).
- The refresh token lives in an httpOnly cookie named `x-refresh-token` — never read it from JS; rely on the browser sending it automatically via `credentials: 'include'`.
- The chat WebSocket authenticates via the **query parameter** `x-access-token` (not a header) — see `src/routes/chat.ts` in the backend.
- Bun is the package manager/runtime for both the backend and `ui/`.
- Svelte 5 runes mode is enabled project-wide (`vite.config.ts` → `compilerOptions.runes`).
- No new frontend testing framework is added. Automated tests use Bun's built-in `bun test` runner, and only for framework-agnostic `.ts` modules (not `.svelte` or `.svelte.ts` runes files, which `bun test` cannot compile). Runes-based stores and components are verified manually via the dev server — this matches the spec's approved "manual verification" testing approach.
- Styling: Tailwind v4 utility classes matching the existing dark slate palette already used in `src/routes/+page.svelte`. No new design system work.
- Spec reference: `docs/superpowers/specs/2026-07-22-chat-app-frontend-design.md`.

---

### Task 1: Backend CORS support

**Files:**
- Modify: `/Users/edwardrees/Projects/Demo Projects/invite-link/package.json` (add `@elysiajs/cors` dependency, via `bun add`)
- Modify: `/Users/edwardrees/Projects/Demo Projects/invite-link/src/index.ts`

**Interfaces:**
- Consumes: nothing from this plan.
- Produces: CORS headers on all backend responses for origin `http://localhost:5173`, with credentials allowed — required by every later task that calls the backend from the browser.

- [ ] **Step 1: Install the CORS plugin**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link" && bun add @elysiajs/cors
```

Expected: `package.json` gains `"@elysiajs/cors"` under `dependencies`.

- [ ] **Step 2: Wire it into the app**

Edit `/Users/edwardrees/Projects/Demo Projects/invite-link/src/index.ts`:

```ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import 'dotenv/config';
import { auth_routes, user_routes, group_routes, invite_routes, belonging_routes, chat_routes } from './routes';
import { db } from './util/db.ts';

const app = new Elysia()
  .use(
    cors({
      origin: 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'x-access-token']
    })
  )
  .get("/", () => "Hello Elysia")
  .get("/health", () => "Healthy!")
  .group("/users", (app) => user_routes(app))
  .group("/auth", (app) => auth_routes(app))
  .group("/groups", (app) => group_routes(app))
  .group("/belonging", (app) => belonging_routes(app))
  .use(chat_routes)
  .use(invite_routes)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
```

- [ ] **Step 3: Verify CORS headers**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link" && bun dev &
sleep 1
curl -s -i -H "Origin: http://localhost:5173" http://localhost:3000/health
curl -s -i -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: x-access-token,content-type" \
  http://localhost:3000/auth/login
kill %1
```

Expected: the first response includes `Access-Control-Allow-Origin: http://localhost:5173` and `Access-Control-Allow-Credentials: true`. The second (preflight) response is `204` or `200` and includes `Access-Control-Allow-Headers` containing `x-access-token` and `Access-Control-Allow-Methods` containing `POST`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link" && git add package.json bun.lock src/index.ts && git commit -m "feat: enable CORS for the SvelteKit dev origin"
```

---

### Task 2: Frontend project setup

**Files:**
- Create: `ui/.env.example`
- Create: `ui/.env`
- Create: `ui/src/routes/+layout.ts`
- Modify: `ui/package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `PUBLIC_API_URL` env var (read via `$env/static/public` in later tasks), SSR disabled for the whole app, a `bun test` script.

- [ ] **Step 1: Add env files**

Create `ui/.env.example`:

```
PUBLIC_API_URL=http://localhost:3000
```

Create `ui/.env` (already gitignored by the existing `ui/.gitignore` `.env` / `.env.*` rules):

```
PUBLIC_API_URL=http://localhost:3000
```

- [ ] **Step 2: Disable SSR app-wide**

Create `ui/src/routes/+layout.ts`:

```ts
export const ssr = false;
```

- [ ] **Step 3: Add a test script**

Edit `ui/package.json`, adding `"test": "bun test"` to `scripts`:

```json
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"preview": "vite preview",
		"prepare": "svelte-kit sync || echo ''",
		"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
		"check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
		"test": "bun test",
		"lint": "prettier --check .",
		"format": "prettier --write ."
	},
```

- [ ] **Step 4: Verify**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun run check
```

Expected: completes with no errors (same as before this task — confirms the new `+layout.ts` doesn't break the build).

- [ ] **Step 5: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add .env.example src/routes/+layout.ts package.json && git commit -m "chore: configure PUBLIC_API_URL, disable SSR, add test script"
```

Note: `ui/.env` itself is gitignored and won't be added by this command — that's expected.

---

### Task 3: JWT payload decode helper

**Files:**
- Create: `ui/src/lib/jwt.ts`
- Test: `ui/src/lib/jwt.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `decodeJwtPayload<T>(token: string): T | null` and `decodeAccessToken(token: string): { sub: number } | null`, both used by Task 4 (auth store) and Task 14 (join page, to read the invite token's `sub`/group id without a network round trip).

- [ ] **Step 1: Write the failing tests**

Create `ui/src/lib/jwt.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { decodeAccessToken, decodeJwtPayload } from './jwt';

function makeToken(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesignature`;
}

describe('decodeJwtPayload', () => {
  test('decodes the payload segment of a JWT', () => {
    const token = makeToken({ sub: 42, aud: 7 });
    expect(decodeJwtPayload<{ sub: number; aud: number }>(token)).toEqual({ sub: 42, aud: 7 });
  });

  test('returns null for a malformed token', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });

  test('returns null for an empty string', () => {
    expect(decodeJwtPayload('')).toBeNull();
  });
});

describe('decodeAccessToken', () => {
  test('returns a numeric sub claim as-is', () => {
    const token = makeToken({ sub: 42, iat: 1, exp: 2 });
    expect(decodeAccessToken(token)).toEqual({ sub: 42 });
  });

  test('coerces a string sub claim to a number', () => {
    const token = makeToken({ sub: '42', iat: 1, exp: 2 });
    expect(decodeAccessToken(token)).toEqual({ sub: 42 });
  });

  test('returns null when sub is missing', () => {
    const token = makeToken({ iat: 1, exp: 2 });
    expect(decodeAccessToken(token)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun test src/lib/jwt.test.ts
```

Expected: FAIL — `Cannot find module './jwt'` (the file doesn't exist yet).

- [ ] **Step 3: Implement**

Create `ui/src/lib/jwt.ts`:

```ts
function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

export function decodeJwtPayload<T>(token: string): T | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(base64UrlDecode(payload)) as T;
  } catch {
    return null;
  }
}

export function decodeAccessToken(token: string): { sub: number } | null {
  const payload = decodeJwtPayload<{ sub?: number | string }>(token);
  if (!payload || payload.sub === undefined) return null;
  const sub = typeof payload.sub === 'string' ? Number(payload.sub) : payload.sub;
  return Number.isFinite(sub) ? { sub } : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun test src/lib/jwt.test.ts
```

Expected: PASS — `6 pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add src/lib/jwt.ts src/lib/jwt.test.ts && git commit -m "feat: add JWT payload decode helper"
```

---

### Task 4: Auth reactive store

**Files:**
- Create: `ui/src/lib/auth.svelte.ts`

**Interfaces:**
- Consumes: `decodeAccessToken` from `ui/src/lib/jwt.ts` (Task 3).
- Produces: a singleton `authState` object with reactive `accessToken: string | null`, a derived `userId: number | null` getter, and `setToken(token: string): void` / `clearToken(): void` methods. Used by Task 6 (API client wiring), Task 7 (layout guard), Task 8/10 (signup/login), Task 15 (chat page).

- [ ] **Step 1: Implement**

Create `ui/src/lib/auth.svelte.ts`:

```ts
import { decodeAccessToken } from './jwt';

const STORAGE_KEY = 'accessToken';

function readStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

class AuthState {
  accessToken = $state<string | null>(readStoredToken());

  get userId(): number | null {
    if (!this.accessToken) return null;
    return decodeAccessToken(this.accessToken)?.sub ?? null;
  }

  setToken(token: string) {
    this.accessToken = token;
    localStorage.setItem(STORAGE_KEY, token);
  }

  clearToken() {
    this.accessToken = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const authState = new AuthState();
```

- [ ] **Step 2: Verify**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun run check
```

Expected: no type errors. `$state` and runes syntax can't run under plain `bun test` (Bun doesn't compile Svelte files), so this module has no unit test file — it's exercised end-to-end once Task 8 (signup) and Task 10 (login) wire it up, and manually verified then (token persists across a page reload, `userId` matches the signed-up account).

- [ ] **Step 3: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add src/lib/auth.svelte.ts && git commit -m "feat: add reactive auth token store"
```

---

### Task 5: Chat WebSocket pure helpers

**Files:**
- Create: `ui/src/lib/ws.ts`
- Test: `ui/src/lib/ws.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type ChatMessage = { userId: number; text: string; ts: number }`, `type ChatEvent = { type: 'history'; messages: ChatMessage[] } | ({ type: 'message' } & ChatMessage)`, `buildChatWsUrl(httpBaseUrl: string, groupId: string, accessToken: string): string`, `parseChatEvent(raw: string): ChatEvent`. Used by Task 15 (chat page).

- [ ] **Step 1: Write the failing tests**

Create `ui/src/lib/ws.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { buildChatWsUrl, parseChatEvent } from './ws';

describe('buildChatWsUrl', () => {
  test('converts an http base to ws and includes the token as a query param', () => {
    const url = buildChatWsUrl('http://localhost:3000', '5', 'abc.def.ghi');
    expect(url).toBe('ws://localhost:3000/ws/5?x-access-token=abc.def.ghi');
  });

  test('converts an https base to wss', () => {
    const url = buildChatWsUrl('https://api.example.com', '5', 'tok');
    expect(url).toBe('wss://api.example.com/ws/5?x-access-token=tok');
  });
});

describe('parseChatEvent', () => {
  test('parses a history event', () => {
    const event = parseChatEvent(
      JSON.stringify({ type: 'history', messages: [{ userId: 1, text: 'hi', ts: 100 }] })
    );
    expect(event).toEqual({ type: 'history', messages: [{ userId: 1, text: 'hi', ts: 100 }] });
  });

  test('parses a message event', () => {
    const event = parseChatEvent(JSON.stringify({ type: 'message', userId: 2, text: 'yo', ts: 200 }));
    expect(event).toEqual({ type: 'message', userId: 2, text: 'yo', ts: 200 });
  });

  test('throws on an unknown event type', () => {
    expect(() => parseChatEvent(JSON.stringify({ type: 'ping' }))).toThrow(
      'Unknown chat event type: ping'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun test src/lib/ws.test.ts
```

Expected: FAIL — `Cannot find module './ws'`.

- [ ] **Step 3: Implement**

Create `ui/src/lib/ws.ts`:

```ts
export type ChatMessage = { userId: number; text: string; ts: number };

export type ChatEvent =
  | { type: 'history'; messages: ChatMessage[] }
  | ({ type: 'message' } & ChatMessage);

export function buildChatWsUrl(httpBaseUrl: string, groupId: string, accessToken: string): string {
  const wsBase = httpBaseUrl.replace(/^http/, 'ws');
  return `${wsBase}/ws/${groupId}?x-access-token=${encodeURIComponent(accessToken)}`;
}

export function parseChatEvent(raw: string): ChatEvent {
  const data = JSON.parse(raw) as { type?: string };
  if (data.type !== 'history' && data.type !== 'message') {
    throw new Error(`Unknown chat event type: ${String(data.type)}`);
  }
  return data as ChatEvent;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun test src/lib/ws.test.ts
```

Expected: PASS — `5 pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add src/lib/ws.ts src/lib/ws.test.ts && git commit -m "feat: add chat WebSocket URL and event-parsing helpers"
```

---

### Task 6: API client (fetch wrapper with refresh-retry)

**Files:**
- Create: `ui/src/lib/apiClient.ts`
- Test: `ui/src/lib/apiClient.test.ts`
- Create: `ui/src/lib/api.ts`

**Interfaces:**
- Consumes: `authState` from `ui/src/lib/auth.svelte.ts` (Task 4), `PUBLIC_API_URL` from `$env/static/public` (Task 2).
- Produces (from `api.ts`, used by every later page task): `apiFetch(path: string, init?: RequestInit): Promise<Response>`, `apiJson<T>(path: string, init?: RequestInit): Promise<T>` (throws `ApiError` on non-2xx), `class ApiError extends Error { status: number }`.
- Produces (from `apiClient.ts`, framework-agnostic, used only by its own test): `createApiClient(baseUrl: string, tokens: TokenStore, fetchImpl?: typeof fetch): { apiFetch, apiJson }`, `interface TokenStore { get(): string | null; set(token: string): void; clear(): void }`.

- [ ] **Step 1: Write the failing tests**

Create `ui/src/lib/apiClient.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { createApiClient, ApiError, type TokenStore } from './apiClient';

function makeTokenStore(initial: string | null): TokenStore & { current: () => string | null } {
  let token = initial;
  return {
    get: () => token,
    set: (t: string) => {
      token = t;
    },
    clear: () => {
      token = null;
    },
    current: () => token
  };
}

describe('createApiClient', () => {
  test('attaches the access token header on requests', async () => {
    const urls: string[] = [];
    const inits: RequestInit[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      urls.push(url);
      inits.push(init);
      return new Response('{"ok":true}', { status: 200 });
    }) as unknown as typeof fetch;

    const tokens = makeTokenStore('tok-1');
    const client = createApiClient('http://api.test', tokens, fetchImpl);

    const res = await client.apiFetch('/thing');

    expect(res.status).toBe(200);
    expect(urls[0]).toBe('http://api.test/thing');
    expect(new Headers(inits[0].headers).get('x-access-token')).toBe('tok-1');
  });

  test('refreshes and retries once on a 401, updating the token store', async () => {
    let callCount = 0;
    const fetchImpl = (async (url: string, init: RequestInit = {}) => {
      callCount++;
      if (url === 'http://api.test/auth/refresh') {
        return new Response(JSON.stringify({ 'x-access-token': 'tok-2' }), { status: 200 });
      }
      const headers = new Headers(init.headers);
      if (headers.get('x-access-token') === 'tok-1') {
        return new Response('unauthorized', { status: 401 });
      }
      return new Response('{"ok":true}', { status: 200 });
    }) as unknown as typeof fetch;

    const tokens = makeTokenStore('tok-1');
    const client = createApiClient('http://api.test', tokens, fetchImpl);

    const res = await client.apiFetch('/thing');

    expect(res.status).toBe(200);
    expect(tokens.current()).toBe('tok-2');
    expect(callCount).toBe(3);
  });

  test('clears the token store when the refresh itself fails', async () => {
    const fetchImpl = (async () => new Response('unauthorized', { status: 401 })) as unknown as typeof fetch;

    const tokens = makeTokenStore('tok-1');
    const client = createApiClient('http://api.test', tokens, fetchImpl);

    const res = await client.apiFetch('/thing');

    expect(res.status).toBe(401);
    expect(tokens.current()).toBeNull();
  });

  test('apiJson throws an ApiError carrying the status and body text on a non-ok response', async () => {
    const fetchImpl = (async () => new Response('Conflict: duplicate', { status: 409 })) as unknown as typeof fetch;
    const tokens = makeTokenStore(null);
    const client = createApiClient('http://api.test', tokens, fetchImpl);

    await expect(client.apiJson('/thing')).rejects.toBeInstanceOf(ApiError);
    try {
      await client.apiJson('/thing');
      throw new Error('expected apiJson to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(409);
      expect((err as ApiError).message).toBe('Conflict: duplicate');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun test src/lib/apiClient.test.ts
```

Expected: FAIL — `Cannot find module './apiClient'`.

- [ ] **Step 3: Implement the framework-agnostic client**

Create `ui/src/lib/apiClient.ts`:

```ts
export interface TokenStore {
  get(): string | null;
  set(token: string): void;
  clear(): void;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function createApiClient(baseUrl: string, tokens: TokenStore, fetchImpl: typeof fetch = fetch) {
  async function rawFetch(path: string, init: RequestInit = {}, token?: string | null): Promise<Response> {
    const headers = new Headers(init.headers);
    if (token) headers.set('x-access-token', token);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return fetchImpl(`${baseUrl}${path}`, { ...init, headers, credentials: 'include' });
  }

  let refreshInFlight: Promise<string | null> | null = null;

  async function refreshAccessToken(): Promise<string | null> {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const res = await rawFetch('/auth/refresh', { method: 'POST' });
        if (!res.ok) return null;
        const body = (await res.json()) as { 'x-access-token': string };
        return body['x-access-token'];
      })().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = tokens.get();
    let res = await rawFetch(path, init, token);

    if (res.status === 401 && token) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        tokens.set(newToken);
        res = await rawFetch(path, init, newToken);
      } else {
        tokens.clear();
      }
    }

    return res;
  }

  async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await apiFetch(path, init);
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new ApiError(res.status, text || res.statusText);
    }
    return (await res.json()) as T;
  }

  return { apiFetch, apiJson };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun test src/lib/apiClient.test.ts
```

Expected: PASS — `4 pass, 0 fail`.

- [ ] **Step 5: Wire it up for the app**

Create `ui/src/lib/api.ts`:

```ts
import { PUBLIC_API_URL } from '$env/static/public';
import { authState } from './auth.svelte';
import { createApiClient, ApiError } from './apiClient';

const client = createApiClient(PUBLIC_API_URL, {
  get: () => authState.accessToken,
  set: (token) => authState.setToken(token),
  clear: () => authState.clearToken()
});

export const apiFetch = client.apiFetch;
export const apiJson = client.apiJson;
export { ApiError };
```

- [ ] **Step 6: Verify the wiring type-checks**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun run check
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add src/lib/apiClient.ts src/lib/apiClient.test.ts src/lib/api.ts && git commit -m "feat: add API client with 401 refresh-and-retry"
```

---

### Task 7: `(app)` route group — auth guard and nav

**Files:**
- Create: `ui/src/routes/(app)/+layout.svelte`

**Interfaces:**
- Consumes: `authState` (Task 4).
- Produces: every route placed under `src/routes/(app)/...` is only reachable with a token present (redirects to `/login` otherwise), and gets a nav bar showing the current user id and a logout button. Used by Tasks 9, 12, 13, 14, 15.

- [ ] **Step 1: Implement**

Create `ui/src/routes/(app)/+layout.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { authState } from '$lib/auth.svelte';

	let { children } = $props();

	$effect(() => {
		if (!authState.accessToken) {
			goto('/login');
		}
	});

	function logout() {
		authState.clearToken();
		goto('/');
	}
</script>

{#if authState.accessToken}
	<div class="min-h-screen bg-slate-800 text-slate-100">
		<nav class="flex items-center justify-between border-b border-slate-700 px-5 py-3">
			<a href="/groups" class="text-lg font-semibold">Groups</a>
			<div class="flex items-center gap-4 text-sm text-slate-300">
				<span>Your ID: {authState.userId}</span>
				<button onclick={logout} class="hover:text-white">Log out</button>
			</div>
		</nav>
		<div class="px-5 py-6">
			{@render children()}
		</div>
	</div>
{/if}
```

- [ ] **Step 2: Verify**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun run check
```

Expected: no type errors. This route group currently has no pages inside it, so there is nothing to manually click through yet — that happens starting Task 9.

- [ ] **Step 3: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add "src/routes/(app)/+layout.svelte" && git commit -m "feat: add authenticated route group with guard and nav"
```

---

### Task 8: Signup page

**Files:**
- Create: `ui/src/routes/signup/+page.svelte`

**Interfaces:**
- Consumes: `apiJson`, `ApiError` (Task 6), `authState.setToken` (Task 4).
- Produces: `/signup` route. Backend calls: `POST /auth/signup {email, password}` then `POST /users {name}`.

- [ ] **Step 1: Implement**

Create `ui/src/routes/signup/+page.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { authState } from '$lib/auth.svelte';
	import { apiJson, ApiError } from '$lib/api';

	let email = $state('');
	let password = $state('');
	let name = $state('');
	let error = $state('');
	let submitting = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		submitting = true;
		try {
			const signupResult = await apiJson<{ 'x-access-token': string }>('/auth/signup', {
				method: 'POST',
				body: JSON.stringify({ email, password })
			});
			authState.setToken(signupResult['x-access-token']);

			await apiJson('/users', {
				method: 'POST',
				body: JSON.stringify({ name })
			});

			goto('/groups');
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<main class="min-h-screen bg-slate-800 px-5 py-10 text-slate-100">
	<div class="mx-auto max-w-sm">
		<h1 class="mb-6 text-center text-2xl font-bold">Sign up</h1>
		<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
			<label class="flex flex-col gap-1">
				<span>Display name</span>
				<input class="rounded bg-slate-700 px-3 py-2" type="text" bind:value={name} required />
			</label>
			<label class="flex flex-col gap-1">
				<span>Email</span>
				<input class="rounded bg-slate-700 px-3 py-2" type="email" bind:value={email} required />
			</label>
			<label class="flex flex-col gap-1">
				<span>Password</span>
				<input class="rounded bg-slate-700 px-3 py-2" type="password" bind:value={password} required />
			</label>
			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}
			<button
				class="rounded bg-emerald-600 px-3 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
				type="submit"
				disabled={submitting}
			>
				{submitting ? 'Signing up...' : 'Sign up'}
			</button>
		</form>
		<p class="mt-4 text-center text-sm text-slate-400">
			Already have an account? <a class="underline" href="/login">Log in</a>
		</p>
	</div>
</main>
```

- [ ] **Step 2: Manual verification**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link" && bun dev &
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun run dev &
```

In a browser, visit `http://localhost:5173/signup`, fill in a display name, a fresh email, and a password, submit. Expected: navigates to `/groups` (which will 404/blank until Task 12 — that's fine, it confirms the redirect happened). Open devtools → Application → Local Storage and confirm an `accessToken` key was set. Then stop both dev servers (`kill %1 %2` in the respective shells, or Ctrl-C).

- [ ] **Step 3: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add src/routes/signup/+page.svelte && git commit -m "feat: add signup page"
```

---

### Task 9: Complete-profile page

**Files:**
- Create: `ui/src/routes/(app)/complete-profile/+page.svelte`

**Interfaces:**
- Consumes: `apiJson`, `ApiError` (Task 6), the `(app)` layout guard (Task 7).
- Produces: `/complete-profile` route, reachable only when logged in. Backend call: `POST /users {name}`.

- [ ] **Step 1: Implement**

Create `ui/src/routes/(app)/complete-profile/+page.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { apiJson, ApiError } from '$lib/api';

	let name = $state('');
	let error = $state('');
	let submitting = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		submitting = true;
		try {
			await apiJson('/users', {
				method: 'POST',
				body: JSON.stringify({ name })
			});
			goto('/groups');
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="mx-auto max-w-sm">
	<h1 class="mb-6 text-center text-2xl font-bold">One more step</h1>
	<p class="mb-4 text-sm text-slate-400">Choose a display name to finish setting up your account.</p>
	<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
		<label class="flex flex-col gap-1">
			<span>Display name</span>
			<input class="rounded bg-slate-700 px-3 py-2" type="text" bind:value={name} required />
		</label>
		{#if error}
			<p class="text-sm text-red-400">{error}</p>
		{/if}
		<button
			class="rounded bg-emerald-600 px-3 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
			type="submit"
			disabled={submitting}
		>
			{submitting ? 'Saving...' : 'Continue'}
		</button>
	</form>
</div>
```

- [ ] **Step 2: Verify**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun run check
```

Expected: no type errors. Full manual exercise of this page happens in Task 10 (a login where no profile exists yet lands here) and Task 16 (end-to-end pass).

- [ ] **Step 3: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add "src/routes/(app)/complete-profile/+page.svelte" && git commit -m "feat: add complete-profile fallback page"
```

---

### Task 10: Login page

**Files:**
- Create: `ui/src/routes/login/+page.svelte`

**Interfaces:**
- Consumes: `apiFetch`, `apiJson`, `ApiError` (Task 6), `authState.setToken` / `authState.userId` (Task 4).
- Produces: `/login` route. Backend calls: `POST /auth/login {email, password}` then `GET /users/:id` to check whether a profile exists.

- [ ] **Step 1: Implement**

Create `ui/src/routes/login/+page.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { authState } from '$lib/auth.svelte';
	import { apiFetch, apiJson, ApiError } from '$lib/api';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let submitting = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		submitting = true;
		try {
			const loginResult = await apiJson<{ 'x-access-token': string }>('/auth/login', {
				method: 'POST',
				body: JSON.stringify({ email, password })
			});
			authState.setToken(loginResult['x-access-token']);

			const userId = authState.userId;
			const profileRes = await apiFetch(`/users/${userId}`);
			const profileText = profileRes.ok ? await profileRes.text() : '';
			const profile = profileText ? JSON.parse(profileText) : null;

			goto(profile ? '/groups' : '/complete-profile');
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<main class="min-h-screen bg-slate-800 px-5 py-10 text-slate-100">
	<div class="mx-auto max-w-sm">
		<h1 class="mb-6 text-center text-2xl font-bold">Log in</h1>
		<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
			<label class="flex flex-col gap-1">
				<span>Email</span>
				<input class="rounded bg-slate-700 px-3 py-2" type="email" bind:value={email} required />
			</label>
			<label class="flex flex-col gap-1">
				<span>Password</span>
				<input class="rounded bg-slate-700 px-3 py-2" type="password" bind:value={password} required />
			</label>
			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}
			<button
				class="rounded bg-emerald-600 px-3 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
				type="submit"
				disabled={submitting}
			>
				{submitting ? 'Logging in...' : 'Log in'}
			</button>
		</form>
		<p class="mt-4 text-center text-sm text-slate-400">
			Need an account? <a class="underline" href="/signup">Sign up</a>
		</p>
	</div>
</main>
```

- [ ] **Step 2: Manual verification**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link" && bun dev &
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun run dev &
```

In a browser, visit `http://localhost:5173/login` and log in with the account created in Task 8. Expected: redirected to `/groups` (profile already exists from Task 8's `POST /users` call). Then clear `accessToken` from Local Storage, sign up a *second* account directly via curl (skipping the `POST /users` step) to simulate an incomplete signup:

```bash
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"incomplete@example.com","password":"password123"}'
```

Log in as `incomplete@example.com` / `password123` through the UI. Expected: redirected to `/complete-profile` instead. Stop both dev servers when done.

- [ ] **Step 3: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add src/routes/login/+page.svelte && git commit -m "feat: add login page"
```

---

### Task 11: Landing page — auth-aware CTA

**Files:**
- Modify: `ui/src/routes/+page.svelte`

**Interfaces:**
- Consumes: `authState.accessToken` (Task 4).
- Produces: `/` auto-redirects to `/groups` when already logged in; otherwise shows Log in / Sign up buttons.

- [ ] **Step 1: Implement**

Replace the contents of `ui/src/routes/+page.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authState } from '$lib/auth.svelte';

	onMount(() => {
		if (authState.accessToken) {
			goto('/groups');
		}
	});
</script>

<main class="bg-slate-800 text-slate-100 min-h-screen min-w-screen px-5">
<h1 class="py-5 text-3xl text-center">Welcome to this simple group system!</h1>
<p class="text-xl text-center">Log in to get started!</p>
<div class="flex justify-center gap-4 pt-4">
	<a href="/login" class="rounded bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500">Log in</a>
	<a href="/signup" class="rounded bg-slate-700 px-4 py-2 font-semibold hover:bg-slate-600">Sign up</a>
</div>
</main>
```

- [ ] **Step 2: Verify**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun run check
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add src/routes/+page.svelte && git commit -m "feat: add auth-aware CTAs to the landing page"
```

---

### Task 12: Groups list page

**Files:**
- Create: `ui/src/routes/(app)/groups/+page.svelte`

**Interfaces:**
- Consumes: `apiJson`, `ApiError` (Task 6), `(app)` layout (Task 7).
- Produces: `/groups` route. Backend calls: `GET /belonging`, `POST /groups {name}`.

- [ ] **Step 1: Implement**

Create `ui/src/routes/(app)/groups/+page.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { apiJson, ApiError } from '$lib/api';

	type Belonging = { group_id: number; group_name: string };

	let groups = $state<Belonging[]>([]);
	let loadError = $state('');
	let newGroupName = $state('');
	let createError = $state('');
	let creating = $state(false);

	async function loadGroups() {
		loadError = '';
		try {
			groups = await apiJson<Belonging[]>('/belonging');
		} catch (err) {
			loadError = err instanceof ApiError ? err.message : 'Failed to load groups.';
		}
	}

	async function handleCreate(event: SubmitEvent) {
		event.preventDefault();
		createError = '';
		creating = true;
		try {
			await apiJson('/groups', {
				method: 'POST',
				body: JSON.stringify({ name: newGroupName })
			});
			newGroupName = '';
			await loadGroups();
		} catch (err) {
			createError = err instanceof ApiError ? err.message : 'Failed to create group.';
		} finally {
			creating = false;
		}
	}

	onMount(loadGroups);
</script>

<h1 class="mb-4 text-2xl font-bold">Your groups</h1>

{#if loadError}
	<p class="mb-4 text-sm text-red-400">{loadError}</p>
{/if}

<ul class="mb-8 flex flex-col gap-2">
	{#each groups as group (group.group_id)}
		<li>
			<a class="block rounded bg-slate-700 px-4 py-3 hover:bg-slate-600" href={`/groups/${group.group_id}`}>
				{group.group_name}
			</a>
		</li>
	{:else}
		<li class="text-slate-400">You're not in any groups yet.</li>
	{/each}
</ul>

<h2 class="mb-2 text-lg font-semibold">Create a group</h2>
<form class="flex max-w-sm gap-2" onsubmit={handleCreate}>
	<input
		class="flex-1 rounded bg-slate-700 px-3 py-2"
		type="text"
		placeholder="Group name"
		bind:value={newGroupName}
		required
	/>
	<button
		class="rounded bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
		type="submit"
		disabled={creating}
	>
		Create
	</button>
</form>
{#if createError}
	<p class="mt-2 text-sm text-red-400">{createError}</p>
{/if}
```

- [ ] **Step 2: Manual verification**

Start both dev servers as in Task 10. Log in with an existing account, land on `/groups`. Create a group named "Test Group" — expect it to appear in the list immediately. Reload the page — expect it to still be listed (confirms `GET /belonging` round-trips correctly). Try creating a group with the same name again — expect the inline error from the backend's 409 response.

- [ ] **Step 3: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add "src/routes/(app)/groups/+page.svelte" && git commit -m "feat: add groups list and create-group form"
```

---

### Task 13: Group detail + invite page

**Files:**
- Create: `ui/src/routes/(app)/groups/[id]/+page.svelte`

**Interfaces:**
- Consumes: `apiJson`, `ApiError` (Task 6), `page.params.id` from `$app/state`.
- Produces: `/groups/[id]` route. Backend call: `POST /invite {target_user_id, group_id}`.

- [ ] **Step 1: Implement**

Create `ui/src/routes/(app)/groups/[id]/+page.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { apiJson, ApiError } from '$lib/api';

	const groupId = page.params.id;

	let targetUserId = $state('');
	let inviteLink = $state('');
	let inviteError = $state('');
	let inviting = $state(false);

	async function handleInvite(event: SubmitEvent) {
		event.preventDefault();
		inviteError = '';
		inviteLink = '';
		inviting = true;
		try {
			const result = await apiJson<{ data: string }>('/invite', {
				method: 'POST',
				body: JSON.stringify({
					target_user_id: Number(targetUserId),
					group_id: Number(groupId)
				})
			});
			inviteLink = `${window.location.origin}${result.data}`;
		} catch (err) {
			inviteError = err instanceof ApiError ? err.message : 'Failed to create invite.';
		} finally {
			inviting = false;
		}
	}
</script>

<h1 class="mb-4 text-2xl font-bold">Group #{groupId}</h1>

<a
	class="mb-6 inline-block rounded bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500"
	href={`/groups/${groupId}/chat`}
>
	Open chat
</a>

<h2 class="mb-2 text-lg font-semibold">Invite a member</h2>
<p class="mb-2 text-sm text-slate-400">
	Enter the numeric user id of the person you want to invite — they can find their own id in the
	nav bar after logging in. Only the group's owner can create invites.
</p>
<form class="flex max-w-sm gap-2" onsubmit={handleInvite}>
	<input
		class="flex-1 rounded bg-slate-700 px-3 py-2"
		type="number"
		placeholder="User id"
		bind:value={targetUserId}
		required
	/>
	<button
		class="rounded bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
		type="submit"
		disabled={inviting}
	>
		Invite
	</button>
</form>
{#if inviteError}
	<p class="mt-2 text-sm text-red-400">{inviteError}</p>
{/if}
{#if inviteLink}
	<p class="mt-2 text-sm text-emerald-400">
		Invite link: <a class="underline" href={inviteLink}>{inviteLink}</a>
	</p>
{/if}
```

- [ ] **Step 2: Manual verification**

With the account from Task 12 (owner of "Test Group"), navigate to that group's detail page. Note your own user id from the nav bar (add 1 to it, or use any other existing account's id, as the invite target — inviting yourself will 409 on join, which is still a useful check that the request reached the backend). Submit the invite form. Expected: an invite link like `http://localhost:5173/join/<token>` appears. A non-owner member (or a fresh curl-created account not in the group) attempting this same form should see "Forbidden: Not the owner of the group!" surfaced as the inline error.

- [ ] **Step 3: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add "src/routes/(app)/groups/[id]/+page.svelte" && git commit -m "feat: add group detail page with invite generation"
```

---

### Task 14: Join-token redemption page

**Files:**
- Create: `ui/src/routes/(app)/join/[token]/+page.svelte`

**Interfaces:**
- Consumes: `apiFetch` (Task 6), `decodeJwtPayload` (Task 3), `page.params.token` from `$app/state`.
- Produces: `/join/[token]` route. Backend call: `POST /join/:token`.

- [ ] **Step 1: Implement**

Create `ui/src/routes/(app)/join/[token]/+page.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { apiFetch } from '$lib/api';
	import { decodeJwtPayload } from '$lib/jwt';

	let status = $state<'joining' | 'error'>('joining');
	let errorMessage = $state('');

	onMount(async () => {
		const token = page.params.token;
		const payload = decodeJwtPayload<{ sub: number }>(token);
		const groupId = payload?.sub;

		try {
			const res = await apiFetch(`/join/${token}`, { method: 'POST' });
			if (res.status === 201 || res.status === 409) {
				goto(groupId ? `/groups/${groupId}` : '/groups');
				return;
			}
			const text = await res.text();
			status = 'error';
			errorMessage = text || 'Could not join the group.';
		} catch {
			status = 'error';
			errorMessage = 'Could not join the group.';
		}
	});
</script>

{#if status === 'joining'}
	<p>Joining group...</p>
{:else}
	<p class="text-red-400">{errorMessage}</p>
	<a class="mt-2 inline-block underline" href="/groups">Back to your groups</a>
{/if}
```

- [ ] **Step 2: Manual verification**

Using the invite link generated in Task 13, log in as a *different* account (one whose user id matches the `target_user_id` used to generate that invite) and visit the link. Expected: briefly shows "Joining group...", then redirects to `/groups/<id>`, and that group now shows up on that account's `/groups` list. Visiting the same link again should still redirect successfully (409-already-a-member path). Visiting a garbage token (e.g. `/join/not-a-real-token`) should show the inline error state.

- [ ] **Step 3: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add "src/routes/(app)/join/[token]/+page.svelte" && git commit -m "feat: add invite link redemption page"
```

---

### Task 15: Chat room page

**Files:**
- Create: `ui/src/routes/(app)/groups/[id]/chat/+page.svelte`

**Interfaces:**
- Consumes: `buildChatWsUrl`, `parseChatEvent`, `ChatMessage` (Task 5), `apiFetch` (Task 6), `authState` (Task 4), `PUBLIC_API_URL` (Task 2).
- Produces: `/groups/[id]/chat` route. Connects to `ws(s)://.../ws/:groupId?x-access-token=...`.

- [ ] **Step 1: Implement**

Create `ui/src/routes/(app)/groups/[id]/chat/+page.svelte`:

```svelte
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { authState } from '$lib/auth.svelte';
	import { apiFetch } from '$lib/api';
	import { buildChatWsUrl, parseChatEvent, type ChatMessage } from '$lib/ws';

	const groupId = page.params.id;

	let messages = $state<ChatMessage[]>([]);
	let draft = $state('');
	let connected = $state(false);
	let names = $state(new Map<number, string>());
	let socket: WebSocket | null = null;

	async function resolveName(userId: number) {
		if (names.has(userId)) return;
		names.set(userId, `User #${userId}`);
		try {
			const res = await apiFetch(`/users/${userId}`);
			const text = res.ok ? await res.text() : '';
			const profile = text ? JSON.parse(text) : null;
			if (profile?.name) {
				names.set(userId, profile.name);
			}
		} catch {
			// keep the fallback label already set above
		}
	}

	function nameFor(userId: number): string {
		return names.get(userId) ?? `User #${userId}`;
	}

	onMount(() => {
		const token = authState.accessToken;
		if (!token) return;

		const ws = new WebSocket(buildChatWsUrl(PUBLIC_API_URL, groupId, token));
		socket = ws;

		ws.onopen = () => {
			connected = true;
		};
		ws.onclose = () => {
			connected = false;
		};
		ws.onerror = () => {
			connected = false;
		};
		ws.onmessage = (event) => {
			const chatEvent = parseChatEvent(event.data);
			if (chatEvent.type === 'history') {
				messages = chatEvent.messages;
			} else {
				messages = [...messages, chatEvent];
			}
			for (const message of messages) {
				resolveName(message.userId);
			}
		};
	});

	onDestroy(() => {
		socket?.close();
	});

	function sendMessage(event: SubmitEvent) {
		event.preventDefault();
		if (!draft.trim() || socket?.readyState !== WebSocket.OPEN) return;
		socket.send(JSON.stringify({ text: draft }));
		draft = '';
	}
</script>

<h1 class="mb-2 text-2xl font-bold">Chat</h1>
<p class={`mb-4 text-sm ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
	{connected ? 'Connected' : 'Disconnected'}
</p>

<div class="mb-4 flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded bg-slate-900 p-4">
	{#each messages as message, i (i)}
		<div class={`flex flex-col ${message.userId === authState.userId ? 'items-end' : 'items-start'}`}>
			<span class="text-xs text-slate-400">{nameFor(message.userId)}</span>
			<span class="rounded bg-slate-700 px-3 py-2">{message.text}</span>
		</div>
	{/each}
</div>

<form class="flex gap-2" onsubmit={sendMessage}>
	<input class="flex-1 rounded bg-slate-700 px-3 py-2" type="text" bind:value={draft} placeholder="Message" />
	<button class="rounded bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500" type="submit">
		Send
	</button>
</form>
```

- [ ] **Step 2: Manual verification**

With both dev servers running, open the chat room for "Test Group" as its owner. Expected: "Connected" shown, empty history (or prior messages if any exist from earlier testing). Type a message and send it — expect it to appear immediately, right-aligned, labeled with your display name. Open a second browser (or an incognito window), log in as the second account that joined the group in Task 14, and open the same group's chat. Expected: that account sees the same message, left-aligned, and can send its own which appears live in the first browser without a reload.

- [ ] **Step 3: Commit**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && git add "src/routes/(app)/groups/[id]/chat/+page.svelte" && git commit -m "feat: add real-time chat room"
```

---

### Task 16: Full end-to-end verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: the entire app built in Tasks 1–15.
- Produces: a confirmed working golden path, matching the spec's "Testing approach" section.

- [ ] **Step 1: Start both servers**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link" && bun dev &
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun run dev &
```

- [ ] **Step 2: Run the golden path**

Using two separate browser profiles/windows (so `localStorage` doesn't collide) for two distinct accounts, work through:

1. Sign up account A (`/signup`) → lands on `/groups`.
2. Create a group as account A → appears in the list.
3. Sign up account B in the other window → note B's user id from the nav bar.
4. As account A, open the group's detail page (`/groups/[id]`), enter B's user id, generate an invite → copy the `/join/<token>` link.
5. As account B, paste the invite link into the address bar → redirected into the group, which now appears on B's `/groups` list.
6. Both accounts open the group's chat page → send messages from each side → confirm both see all messages live, correctly aligned and labeled, with "Connected" showing.
7. Reload the chat page as either account → confirm history reloads via the `history` WebSocket event.
8. Log out as account A (nav bar button) → confirm redirect to `/`, and that visiting `/groups` directly afterward redirects to `/login`.

- [ ] **Step 3: Run automated checks one more time**

```bash
cd "/Users/edwardrees/Projects/Demo Projects/invite-link/ui" && bun test && bun run check
```

Expected: all `bun test` suites pass (jwt: 6 tests, ws: 5 tests, apiClient: 4 tests — 15 total across the three files), and `svelte-check` reports no errors.

- [ ] **Step 4: Stop the dev servers**

```bash
kill %1 %2
```

No commit for this task — it's verification only. If any step in the golden path fails, fix the relevant task's file, re-run that task's own verification, then re-run this end-to-end pass.
