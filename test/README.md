# Tests

All tests and test scripts for the TB Stalwart bot. This document is the single reference for running and writing tests.

---

## Structure

| Path | Description |
|------|-------------|
| `test/unit/` | Unit tests: config, deduplication, subscriptions (file-based), webhook-auth |
| `test/integration/` | Integration tests: i18n (messages, locale, timezone), webhook (E2E with server) |
| `test/webhook.ts` | Manual script: sends a fake POST request (Stalwart format) to verify webhook HMAC + Basic Auth |

---

## Usage

### Default test run (unit + i18n only)

The default `bun test` command runs unit tests and i18n integration tests only (no server spawn):

```bash
bun test
# or explicitly:
bun test test/unit test/integration/i18n.test.ts
```

### By type

```bash
# Unit tests only
bun run test:unit

# All integration tests (i18n + webhook E2E)
bun run test:integration

# Webhook E2E only (spawns server, then POST with signature + Basic Auth)
bun run test:e2e
```

The E2E webhook test starts the server, waits for it to respond on `GET /`, then runs two tests: valid signature+auth → 200, invalid signature → 401. It uses a 15s timeout for server startup.

### Manual webhook test (server must be running)

To verify that a **running** server accepts webhook requests (HMAC + Basic Auth):

```bash
# Local server (default: http://localhost:3000)
bun run test:webhook:local

# With a specific event type (for Telegram message rendering)
bun run test:webhook:local -- auth.failed
bun run test:webhook:local -- security.ip-blocked
```

**Remote URL:**

```bash
bun run test:webhook https://mail.example.com/
bun run test:webhook https://mail.example.com/ -- auth.success
```

When `WEBHOOK_KEY`, `WEBHOOK_USERNAME`, and `WEBHOOK_PASSWORD` are set in `.env`, the script signs and authenticates the request. If all three are empty, it sends an unauthenticated request (for servers with no webhook auth).

### Direct execution of webhook script

```bash
bun run test/webhook.ts
bun run test/webhook.ts http://localhost:3000 auth.failed
```

---

## Supported event types (for manual webhook tests)

You can pass any of these as the optional event type argument to the webhook script:

- `auth.error`, `auth.failed`, `auth.success`
- `delivery.completed`, `delivery.delivered`, `delivery.failed`
- `security.abuse-ban`, `security.authentication-ban`, `security.ip-blocked`
- `server.startup`, `server.startup-error`

---

## Environment variables for tests

- **Unit / integration (no server):** No special env required. Subscription tests use a temp directory and `SUBSCRIPTIONS_FILE` set in the test.
- **E2E webhook (`test:e2e`):** The test sets `TELEGRAM_BOT_TOKEN`, `WEBHOOK_KEY`, `WEBHOOK_USERNAME`, `WEBHOOK_PASSWORD`, `PORT`, `DATABASE_USE=false`. No real Telegram token needed; the server is only checked for HTTP 200/401.
- **Manual webhook script:** Uses `.env` from the project root. `WEBHOOK_KEY`, `WEBHOOK_USERNAME`, `WEBHOOK_PASSWORD` are optional; when set, the request is signed and authenticated.

---

## Writing tests

- **Runner:** [Bun test](https://bun.sh/docs/test).
- **Unit tests:** Prefer isolated modules; use temp files or env overrides for file-based state.
- **Integration:** E2E webhook test spawns the real server; increase hook timeout if your environment is slow (see `beforeAll(..., { timeout: 15000 })` in `test/integration/webhook.test.ts`).
