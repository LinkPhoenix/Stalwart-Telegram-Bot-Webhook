# Tests

Test scripts for the TB Stalwart bot.

## Available scripts

| Script | Description |
|--------|-------------|
| `test/webhook.ts` | Sends a fake POST request (Stalwart format) to verify that the webhook accepts and validates HMAC + Basic Auth. |

## Usage

```bash
# Local test (auth.success by default)
bun run test:webhook:local

# Local test with a specific event type (to verify Telegram rendering)
bun run test:webhook:local -- auth.failed
bun run test:webhook:local -- security.ip-blocked

# Test against a specific URL
bun run test:webhook https://mail.example.com/

# URL + event
bun run test:webhook https://mail.example.com/ -- auth.success

# Direct execution
bun run test/webhook.ts
bun run test/webhook.ts http://localhost:3000 auth.failed
```

Supported event types: `auth.error`, `auth.failed`, `auth.success`, `delivery.completed`, `delivery.delivered`, `delivery.failed`, `security.abuse-ban`, `security.authentication-ban`, `security.ip-blocked`, `server.startup`, `server.startup-error`

The `.env` variables `WEBHOOK_KEY`, `WEBHOOK_USERNAME`, `WEBHOOK_PASSWORD` are required (or `WEEBHOOK_*`).
