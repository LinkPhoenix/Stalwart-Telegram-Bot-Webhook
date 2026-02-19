<div align="center">

# ⚠️ BETA

> **This project is currently in beta.** Documentation may be incomplete, and the project is not yet on Docker Hub. Use at your own discretion.

</div>

---

# Telegram Bot + Stalwart Webhook

A Telegram bot that lets users subscribe to events from a [Stalwart](https://stalw.art) mail server sent via webhook. Subscribers receive real-time notifications for the events they choose (authentication, security, delivery, server startup).

---

## Table of contents

- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Docker](#docker)
- [Supported events](#supported-events)
- [Per-event IP allowlist](#per-event-ip-allowlist)
- [Telegram commands](#telegram-commands)
- [Subscriptions](#subscriptions)
- [Testing](#testing)
- [Local deployment: opening the webhook port](#local-deployment-opening-the-webhook-port)
- [Deployment](#deployment)

---

## How it works

1. **Stalwart** sends events (auth, security, delivery, etc.) as `POST` requests to the configured webhook URL.
2. The **server** (Bun) receives the request on `POST /`, verifies the **HMAC signature** (`X-Signature`) and **HTTP Basic Auth** (optional), parses the JSON and extracts the event list.
3. For each recognized event, the server **deduplicates** by `type|IP` (same event from same IP within 60s = one notification). It checks subscriptions and, if the event has a per-event IP allowlist and the source IP is in that list, the notification is skipped.
4. The **Telegram bot** sends each subscriber a formatted message (type, date, id, data).

The Telegram bot runs in **polling** mode by default (or webhook if `TELEGRAM_WEBHOOK_URL` is set). It handles user commands (`/start`, `/subscribe`, `/events`, etc.) and manages subscriptions. The HTTP server and the bot run in the same process.

---

## Requirements

- [Bun](https://bun.sh) **or** [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A **`.env`** file at the project root (copy `.env.example` and fill in the values; see [Environment variables](#environment-variables))

---

## Quick start

1. Copy `.env.example` to `.env` and set at least **`TELEGRAM_BOT_TOKEN`** (from [@BotFather](https://t.me/BotFather)). Optionally set `WEBHOOK_KEY`, `WEBHOOK_USERNAME`, and `WEBHOOK_PASSWORD` for webhook security.
2. **With Bun:**
   ```bash
   bun install
   bun run start
   ```
3. **With Docker:** see [Docker](#docker) below.

The server listens on **port 3000** (or the port set by `PORT`). The bot starts in polling mode.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (from [@BotFather](https://t.me/BotFather)). **Required.** |
| `TELEGRAM_TEST_ENV` | (Optional) Set to `true` or `1` if the bot uses Telegram’s **test environment**. |
| `ALLOWED_USER_ID` | (Optional) Single Telegram user ID allowed to use the bot; if empty, anyone can use it. |
| `WEBHOOK_KEY` | (Optional) HMAC key to sign requests (same as `signature-key` in Stalwart). When set, signature verification is enabled. |
| `WEBHOOK_USERNAME` | (Optional) Username for HTTP Basic Auth (same as `auth.username` in Stalwart). |
| `WEBHOOK_PASSWORD` | (Optional) Password for HTTP Basic Auth (same as `auth.secret` in Stalwart). |
| `PORT` | (Optional) HTTP server port. Default: `3000`. |
| `LOG_LEVEL` | (Optional) Logging level: `debug`, `info`, `warn`, `error`. Default: `info`. |
| `SUBSCRIPTION_MIN_SEVERITY` | (Optional) Filter by severity: `info`, `warning`, `alert`. Default: `info`. |
| `QUIET_HOURS_START` / `QUIET_HOURS_END` | (Optional) No notifications in this time window (e.g. `22:00`–`08:00`). |
| `NOTIFICATION_GROUP_WINDOW_SECONDS` | (Optional) Group similar events in one message. `0` = disabled. |
| `TELEGRAM_WEBHOOK_URL` | (Optional) Use Telegram webhook instead of polling (e.g. `https://example.com/telegram-webhook`). |
| `EVENTS_RETENTION_DAYS` | (Optional) Purge events older than X days. `0` = disabled. **Requires database.** |
| `ADMIN_USER_IDS` | (Optional) Comma-separated Telegram user IDs for admin commands. |
| `SUBSCRIPTIONS_FILE` | (Optional) Path to the subscriptions file. Default: `subscriptions.json`. In Docker use e.g. `/app/data/subscriptions.json`. |
| **`<TYPE>_IGNORED_IPS`** | (Optional) Per-event IP allowlist. Example: `AUTH_SUCCESS_IGNORED_IPS=1.1.1.1,1.2.2.2`. See [Per-event IP allowlist](#per-event-ip-allowlist). |
| `DEDUP_ENABLED` | (Optional) Enable deduplication. Default: `true`. |
| `DEDUP_WINDOW_SECONDS` | (Optional) Deduplication window in seconds. Default: `60`. |
| `DATABASE_USE` | (Optional) Set to `true` to use MariaDB/MySQL. Default: `false`. |
| `DATABASE` | (Optional) When `DATABASE_USE=true`: `mariadb` or `mysql`. |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` | (Optional) Database connection. In Docker with DB, use host `mariadb`. |
| `DEFAULT_LOCALE` | (Optional) Default locale: `en`, `fr`, `de`, `es`, `it`. Default: `en`. |
| `DEFAULT_TIMEZONE` | (Optional) Default timezone (e.g. `Europe/Paris`, `UTC`). Default: `UTC`. |
| `HEALTH_ALERT_USER_IDS` | (Optional) Comma-separated Telegram user IDs to notify when `/health` is degraded. |
| `METRICS_PROTECTED` | (Optional) When `true`, `/metrics` requires Basic Auth. Default: `false`. |

When the database is enabled, the bot stores events, blocked IPs, whitelisted IPs, and subscriptions in the database.

### Migrating subscriptions from file to database

```bash
bun run migrate:subscriptions
```

Requires `DATABASE_USE=true` and `DATABASE=mariadb` (or `mysql`) in `.env`.

---

## Docker

Two Compose setups are provided:

| File | Use case |
|------|----------|
| **`docker-compose.yml`** | Build from source (development or self-hosted). Uses `build: .`. |
| **`docker-compose.user.yml`** | End users: run a pre-built image (e.g. from a registry). No build step. |

### Option 1: Build from source (`docker-compose.yml`)

1. Create a `.env` file (copy from `.env.example`).
2. Start the service:
   ```bash
   docker compose up -d
   ```
3. With MariaDB (optional): `docker compose --profile db up -d`
4. Rebuild after code changes: `docker compose up -d --build`

Subscriptions are stored in the `stalwart-data` volume (`SUBSCRIPTIONS_FILE=/app/data/subscriptions.json`).

### Option 2: Pre-built image for end users (`docker-compose.user.yml`)

For users who pull the image instead of building:

1. Create a `.env` file.
2. Run:
   ```bash
   docker compose -f docker-compose.user.yml up -d
   ```
3. With database: `docker compose -f docker-compose.user.yml --profile db up -d`

Update the `image:` value in `docker-compose.user.yml` to your registry (e.g. `ghcr.io/your-org/tb-stalwart:latest`) when the image is published. If you build the image yourself, run `docker build -t tb-stalwart:latest .` then use `docker-compose.user.yml`.

### Deploying alongside Stalwart mail server

Use [`docker-compose.example-stack.yml`](docker-compose.example-stack.yml) as a template to run the bot in the same stack as Stalwart. Set the Stalwart webhook `url` to `http://tb-stalwart:3000/` (service name as hostname).

---

## Webhook security

Requests to `POST /` can be protected by two optional mechanisms (configured via `.env`):

1. **HMAC-SHA256 signature** (when `WEBHOOK_KEY` is set): header `X-Signature`, value = HMAC-SHA256 of the raw JSON body, base64-encoded. Key = `WEBHOOK_KEY`.
2. **HTTP Basic Auth** (when `WEBHOOK_USERNAME` and `WEBHOOK_PASSWORD` are set): header `Authorization: Basic <base64(username:password)>`.

When both are set, both must pass. When neither is set, the endpoint accepts requests without verification. Invalid signature or auth → **401 Unauthorized**.

---

## Supported events

- `auth.error`, `auth.failed`, `auth.success`
- `delivery.completed`, `delivery.delivered`, `delivery.failed`
- `security.abuse-ban`, `security.authentication-ban`, `security.ip-blocked`
- `server.startup`, `server.startup-error`

Other types in the payload are ignored.

---

## Per-event IP allowlist

For each event type you can set **allowed IPs**: when the event’s source IP is in that list, **no Telegram notification is sent**.

- **Variable name:** event type with `.` → `_`, uppercase, suffix `_IGNORED_IPS`.  
  Examples: `auth.success` → `AUTH_SUCCESS_IGNORED_IPS`, `security.ip-blocked` → `SECURITY_IP_BLOCKED_IGNORED_IPS`.
- **Value:** comma-separated IPs, e.g. `1.1.1.1,1.2.2.2`.

Example in `.env`:

```env
AUTH_SUCCESS_IGNORED_IPS=46.225.80.55,176.181.48.249
SECURITY_IP_BLOCKED_IGNORED_IPS=10.0.0.1
```

---

## Telegram commands

- **`/start`** — Welcome and command overview.
- **`/events`** — List of available event types.
- **`/subscribe <event>`** / **`/subscribe all`** — Subscribe to an event or all.
- **`/unsubscribe <event>`** / **`/unsubscribe all`** — Unsubscribe.
- **`/list`** — Your current subscriptions.
- **`/status`** — Bot and webhook status.
- **`/prefs`** — Language, timezone, short notifications.
- **`/help`** — Detailed help.

If `ALLOWED_USER_ID` is set, only that user can use the bot.

---

## Subscriptions

Subscriptions (and user preferences) are stored in the file at **`SUBSCRIPTIONS_FILE`** (default: `subscriptions.json`) or in the database when `DATABASE_USE=true`. The server deduplicates events (same type+IP within the configured window) and skips notifications when the source IP is in the per-event allowlist.

---

## Testing

All test documentation and scripts live in the **[`test/`](test/)** directory. See **[test/README.md](test/README.md)** for:

- Unit and integration test commands
- Webhook test script (local and remote)
- Supported event types for tests

Quick commands:

- Run unit + i18n tests: `bun test` (or `bun run test:unit` for unit only)
- Run webhook E2E (spawns server): `bun run test:e2e`
- Manual webhook test (server must be running): `bun run test:webhook:local`

---

## Local deployment: opening the webhook port

If the bot runs at home and Stalwart is elsewhere, the webhook URL must reach your machine:

1. **Firewall:** Allow incoming TCP on the server port (default 3000).
2. **Router:** Forward that port to the machine running the bot.

Then set the Stalwart webhook `url` to e.g. `http://YOUR_PUBLIC_IP:3000/`. For a changing IP, use a dynamic DNS hostname.

---

## Deployment

The server exposes:

- **`POST /`** — Stalwart webhook. HMAC and Basic Auth required when configured.
- **`GET /`** — Simple health check (200).
- **`GET /health`** — JSON health (DB and bot status).
- **`GET /metrics`** — Prometheus metrics.
- **`GET /dashboard`** — Web dashboard (Basic Auth).
- **`GET /api/export?format=json|csv&days=30&limit=1000`** — Export events (Basic Auth). **Requires database.**
- **`GET /api/backup/subscriptions`** — Backup subscriptions as JSON (Basic Auth).

### Admin commands (Telegram, when using database)

- **`/stats`** — Totals, 24h events, subscribers, events by type (7 days).
- **`/users`** — Subscribers and subscription counts.
- **`/events_count [days]`** — Event count.
- **`/blocked [limit]`** — Blocked IPs with AbuseIPDB links.

Admins are defined by `ADMIN_USER_IDS` (or `ALLOWED_USER_ID` if set).

### Stalwart webhook configuration

- **`signature-key`** = `WEBHOOK_KEY`
- **`auth.username`** = `WEBHOOK_USERNAME`
- **`auth.secret`** = `WEBHOOK_PASSWORD`
- **`url`** = Your bot URL (e.g. `https://mail.example.com/` or `http://localhost:3000/`)

Ensure subscriptions are persisted (Docker volume or durable `SUBSCRIPTIONS_FILE`) so they survive restarts.
