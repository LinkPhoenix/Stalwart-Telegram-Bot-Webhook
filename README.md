<div align="center">

# ⚠️ BETA

> **This project is currently in beta.** The documentation is not yet complete, and the project is not yet available on Docker Hub. Use at your own discretion.

</div>

---

# Telegram Bot + Stalwart Webhook

A Telegram bot that lets users subscribe to events from a [Stalwart](https://stalw.art) mail server sent via webhook. Subscribers receive real-time notifications for the events they choose (authentication, security, delivery, server startup).

---

## Table of contents

- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Webhook security](#webhook-security)
- [Requirements](#requirements)
- [Environment variables](#environment-variables)
- [Running the bot](#running-the-bot)
- [Docker Compose](#docker-compose)
- [Supported events](#supported-events)
- [Per-event IP allowlist](#per-event-ip-allowlist)
- [Telegram commands](#telegram-commands)
- [Subscriptions](#subscriptions)
- [Testing the webhook](#testing-the-webhook)
- [Local testing: opening the webhook port](#local-testing-opening-the-webhook-port)
- [Deployment](#deployment)

---

## How it works

1. **Stalwart** sends events (auth, security, delivery, etc.) as `POST` requests to the configured webhook URL.
2. The **server** (Bun) receives the request on `POST /`, verifies the **HMAC signature** (`X-Signature`) and **HTTP Basic Auth**, parses the JSON and extracts the event list.
3. For each recognized event, the server **deduplicates** by `type|IP` (same event from same IP within 60s = one notification). It checks **subscriptions.json** for subscribers. If the event has a per-event IP allowlist and the source IP is in that list, the notification is skipped.
4. The **Telegram bot** sends each subscriber a formatted message (type, date, id, data).

The Telegram bot runs in **polling** mode (no Telegram webhook): it handles user commands (`/start`, `/subscribe`, `/events`, etc.) and manages subscriptions. The HTTP server and the bot run in the same process.

---

## Architecture

| File | Role |
|------|------|
| **`src/server.ts`** | HTTP server (Bun) + Telegraf bot. Exposes `POST /` (Stalwart webhook), `GET /` and `GET /health`. Receives webhooks, deduplicates events, notifies subscribers (respecting IP allowlists). |
| **`src/config.ts`** | Loads `.env`, validates required variables, builds per-event ignored-IP map. |
| **`src/webhook-auth.ts`** | Webhook verification: HMAC-SHA256 of body (`X-Signature`), Basic Auth (`Authorization`), JSON parsing. |
| **`src/events/registry.ts`** | Central registry of supported event types. Add new events here to enable them for subscriptions. |
| **`src/deduplication.ts`** | Deduplicates notifications by `type|IP` over a configurable window (default 60s) to avoid multiple messages for the same logical event. |
| **`src/subscriptions.ts`** | Persists subscriptions per Telegram user in **`subscriptions.json`** (path configurable via `SUBSCRIPTIONS_FILE`). Read/write on each operation. |
| **`src/messages/`** | Message templates (welcome, event notifications, subscribe/unsubscribe, list). **`getIpFromEvent()`** extracts source IP from event data (`remoteIp`, `ip`, `source_ip`) for notifications and IP allowlist checks. |
| **`test/webhook.ts`** | Test script: sends a fake POST request (same format as Stalwart) with signature and Basic Auth to verify the server accepts webhooks. |
| **`subscriptions.json`** | JSON file: `{ "telegram_user_id": ["event.type", ...] }`. Created/updated automatically. With Docker, use a volume or set `SUBSCRIPTIONS_FILE` to a path inside the container (e.g. `/app/data/subscriptions.json`). |

---

## Webhook security

Requests to `POST /` are protected by **two mechanisms** (both required):

1. **HMAC-SHA256 signature**  
   - Header: `X-Signature`.  
   - Value: HMAC-SHA256 of the **raw body** (JSON), **base64**-encoded.  
   - Key: `WEEBHOOK_KEY` (used as UTF-8 by Stalwart; the code also accepts a hex key for the test script).  
   - Ensures the body is unmodified and comes from someone who knows the key.

2. **HTTP Basic authentication**  
   - Header: `Authorization: Basic <base64(username:password)>`.  
   - Credentials: `WEEBHOOK_USERNAME` and `WEEBHOOK_PASSWORD`, matching `auth.username` and `auth.secret` in the Stalwart webhook config.  
   - Restricts access to the endpoint to authorized clients only.

If the signature is invalid or Basic Auth is wrong, the server responds with **401 Unauthorized** and does not send any notification. The body is parsed only after validation.

---

## Requirements

- [Bun](https://bun.sh) **or** [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A **`.env`** file at the project root (see [Environment variables](#environment-variables)); you can copy `.env.example` and fill in the values.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (from [@BotFather](https://t.me/BotFather)). **Required.** |
| `TELEGRAM_TEST_ENV` | (Optional) Set to `true` or `1` if the bot uses Telegram’s **test environment** (test API). |
| `ALLOWED_USER_ID` | (Optional) Single Telegram user ID allowed to use the bot; if empty, anyone can use it. |
| `WEEBHOOK_ID` | (Optional) Webhook identifier (informational). |
| `WEEBHOOK_URL` | (Optional) URL where Stalwart sends events (e.g. `https://mail.example.com/`). Used by the test script when no URL is passed. |
| `WEEBHOOK_KEY` | HMAC key to sign requests (same as `signature-key` in Stalwart). **Required for the webhook.** |
| `WEEBHOOK_USERNAME` | Username for HTTP Basic Auth (same as `auth.username` in Stalwart). **Required for the webhook.** |
| `WEEBHOOK_PASSWORD` | Password for HTTP Basic Auth (same as `auth.secret` in Stalwart). **Required for the webhook.** |
| `PORT` | (Optional) HTTP server port. Default: `3000`. |
| `SUBSCRIPTIONS_FILE` | (Optional) Path to the subscriptions JSON file. Default: `subscriptions.json` in the working directory. Useful in Docker to persist under a volume (e.g. `/app/data/subscriptions.json`). |
| **`<TYPE>_IGNORED_IPS`** | (Optional) **One variable per event type**: comma-separated list of IPs to **allowlist** for that event. No notification is sent when the event’s source IP (from `remoteIp`, `ip`, or `source_ip`) is in this list. Variable name: event type with `.` replaced by `_`, uppercase, suffix `_IGNORED_IPS`. Example: `auth.success` → `AUTH_SUCCESS_IGNORED_IPS=1.1.1.1,1.2.2.2`. See [Per-event IP allowlist](#per-event-ip-allowlist). |
| `DEDUP_ENABLED` | (Optional) Enable deduplication. Default: `true`. Set to `false` to disable. |
| `DEDUP_WINDOW_SECONDS` | (Optional) Deduplication window in seconds. Same event+IP within this window = one notification. Default: `60`. |
| `DATABASE_USE` | (Optional) Set to `true` (or `1`, `yes`, `on`) to enable MariaDB/MySQL storage. Default: `false`. |
| `DATABASE` | (Optional) When `DATABASE_USE=true`, set to `mariadb` or `mysql`. If empty, database is disabled. |
| `DATABASE_HOST` | (Optional) Database host. Default: `localhost`. In Docker: `mariadb`. |
| `DATABASE_PORT` | (Optional) Database port. Default: `3306`. |
| `DATABASE_NAME` | (Optional) Database name. Default: `stalwart_bot`. |
| `DATABASE_USER` | (Optional) Database user. Default: `stalwart`. |
| `DATABASE_PASSWORD` | (Optional) Database password. |

When the database is enabled, the bot stores: **all received events**, **blocked IPs** (from `security.ip-blocked`), **whitelisted IPs** (from `*_IGNORED_IPS`), and **subscriptions** in the database instead of `subscriptions.json`.

---

## Running the bot

1. Copy `.env.example` to `.env` and set at least `TELEGRAM_BOT_TOKEN`, `WEEBHOOK_KEY`, `WEEBHOOK_USERNAME`, and `WEEBHOOK_PASSWORD`.
2. Install dependencies and start:
   ```bash
   bun install
   bun run start
   ```
3. The server listens on `http://localhost:3000` (or the port set by `PORT`). The Telegram bot starts in polling mode.

---

## Docker Compose

You can run the entire stack with Docker Compose. Subscriptions are stored in a Docker volume so they persist across restarts.

1. Create a **`.env`** file at the project root (see [Environment variables](#environment-variables)).
2. Start the service:
   ```bash
   docker compose up -d
   ```
3. View logs: `docker compose logs -f tb-stalwart`
4. Stop: `docker compose down`

The compose file sets `SUBSCRIPTIONS_FILE=/app/data/subscriptions.json` and mounts a volume at `/app/data`, so **subscriptions are kept** when you restart or recreate the container. To rebuild the image after code changes: `docker compose up -d --build`.

### Using MariaDB for storage

To store events, blocked IPs, whitelisted IPs, and subscriptions in MariaDB:

1. Set in `.env`:
   ```env
   DATABASE_USE=true
   DATABASE=mariadb
   DATABASE_PASSWORD=your-secure-password
   ```
2. Start the stack with the database profile:
   ```bash
   docker compose --profile db up -d
   ```

MariaDB runs with the `db` profile, so it is optional: without `--profile db`, only the bot starts (using file storage). With `--profile db`, MariaDB starts first, then the bot connects and uses the database.

### Deploying alongside Stalwart mail server

To run the bot in the same Docker stack as your Stalwart mail server, use [`docker-compose.example-stack.yml`](docker-compose.example-stack.yml) as a template. Configure the Stalwart webhook `url` to `http://tb-stalwart:3000/` (service name as hostname within the shared network).

---

## Supported events

The following event types are recognized and can be subscribed to:

- `auth.error`
- `auth.failed`
- `auth.success`
- `delivery.completed`
- `delivery.delivered`
- `delivery.failed`
- `security.abuse-ban`
- `security.authentication-ban`
- `security.ip-blocked`
- `server.startup`
- `server.startup-error`

Any other type in the payload is ignored (no error, no notification).

**Adding new events:** edit [`src/events/registry.ts`](src/events/registry.ts) and add a line such as `"auth.too-many-attempts": { hasIp: true }`. Optionally add a custom formatter in `src/messages/event-notification.ts`.

---

## Per-event IP allowlist

For each event type you can define a list of **allowed IPs**: when an event’s source IP is in that list, **no Telegram notification is sent** for that event. This is useful to silence notifications from trusted IPs (e.g. your own servers or known clients).

- **Variable naming**: take the event type, replace `.` with `_`, turn to uppercase, and append `_IGNORED_IPS`.  
  Examples: `auth.success` → `AUTH_SUCCESS_IGNORED_IPS`, `security.ip-blocked` → `SECURITY_IP_BLOCKED_IGNORED_IPS`.
- **Value format**: comma-separated IPs, e.g. `1.1.1.1,1.2.2.2,192.168.1.1`.
- **Source IP**: the server uses the same logic as the message formatter and reads, in order, `remoteIp`, `ip`, or `source_ip` from the event data. If the event has no such field, the allowlist is not applied and the notification is sent as usual.

Example in `.env`:

```env
# Do not send notifications for auth.success from these IPs
AUTH_SUCCESS_IGNORED_IPS=46.225.80.55,176.181.48.249

# Optional: same for other event types
AUTH_FAILED_IGNORED_IPS=
SECURITY_IP_BLOCKED_IGNORED_IPS=10.0.0.1
```

Full list of variable names (each is optional):

`AUTH_ERROR_IGNORED_IPS`, `AUTH_FAILED_IGNORED_IPS`, `AUTH_SUCCESS_IGNORED_IPS`, `DELIVERY_COMPLETED_IGNORED_IPS`, `DELIVERY_DELIVERED_IGNORED_IPS`, `DELIVERY_FAILED_IGNORED_IPS`, `SECURITY_ABUSE_BAN_IGNORED_IPS`, `SECURITY_AUTHENTICATION_BAN_IGNORED_IPS`, `SECURITY_IP_BLOCKED_IGNORED_IPS`, `SERVER_STARTUP_IGNORED_IPS`, `SERVER_STARTUP_ERROR_IGNORED_IPS`.

---

## Telegram commands

- **`/start`** — Welcome message and command overview.
- **`/events`** — List of available event types.
- **`/subscribe <event>`** — Subscribe to an event (e.g. `/subscribe auth.success`).
- **`/unsubscribe <event>`** — Unsubscribe from an event.
- **`/list`** — Show your current subscriptions.

If `ALLOWED_USER_ID` is set, only that Telegram user can use the bot; others receive “Access denied.”

---

## Subscriptions

- Subscriptions are stored in the file pointed to by **`SUBSCRIPTIONS_FILE`** (default: **`subscriptions.json`** at the project root).
- Structure: `{ "telegram_user_id": ["event.type1", "event.type2", ...] }`.
- On each webhook, the server **deduplicates** events (same type+IP within 60s = one notification), loads this file, gets the list of user IDs subscribed to the event type, and sends a Telegram message to each (send errors are logged but do not block others). Events whose source IP is in the per-event allowlist are skipped and do not trigger any notification.

---

## Testing the webhook

1. Start the server (the webhook works even if the Telegram token is invalid):
   ```bash
   bun run start
   ```
2. In another terminal, send a test request (HMAC + Basic Auth) to `http://localhost:3000`:
   ```bash
   bun run test:webhook:local
   ```
   You should see: **Test successful: webhook received and verified.**

   To test the Telegram rendering for a specific event type (optional):
   ```bash
   bun run test:webhook:local -- auth.failed
   bun run test:webhook:local -- security.ip-blocked
   ```

To test against another URL (e.g. your deployed server):

```bash
bun run test:webhook https://mail.example.com/
bun run test:webhook https://mail.example.com/ -- auth.success
```

The script uses `WEEBHOOK_KEY`, `WEEBHOOK_USERNAME`, and `WEEBHOOK_PASSWORD` from `.env` to sign and authenticate the request.

All test scripts are grouped in the [`test/`](test/) folder.

---

## Local testing: opening the webhook port

If you run the bot **on your own machine at home** and want Stalwart (e.g. on a remote server) to send webhooks to it, the webhook URL must reach your machine from the internet. Do not forget:

1. **Open the webhook port on your machine**  
   The server listens on **port 3000** by default (or the port set by `PORT` in `.env`). Ensure your **local firewall** allows incoming TCP traffic on that port so the bot can receive HTTP requests.

2. **Forward the port on your router**  
   Configure **port forwarding** (NAT) on your router so that **external port 3000** (or the port you use) is forwarded to the **local IP and port** of the machine running the bot (e.g. `192.168.1.10:3000`). That way, when Stalwart sends a request to `http://<your-public-ip>:3000/`, the router will send it to your machine.

Then set `WEEBHOOK_URL` (and the Stalwart webhook `url`) to your public URL, for example `http://YOUR_PUBLIC_IP:3000/`. If your public IP changes (e.g. with a dynamic ISP), consider using a dynamic DNS hostname instead.

---

## Deployment

The server exposes:

- **`POST /`** — Endpoint to configure in Stalwart (same URL as `WEEBHOOK_URL`). HMAC (`X-Signature`) and Basic Auth are required.
- **`GET /`** and **`GET /health`** — Health check (returns `200 OK`).

On your Stalwart server, configure the webhook with:

- **`signature-key`** = `WEEBHOOK_KEY`
- **`auth.username`** = `WEEBHOOK_USERNAME`
- **`auth.secret`** = `WEEBHOOK_PASSWORD`
- **`url`** = Your instance URL (e.g. `https://mail.example.com/` or `http://localhost:3000/`)

Ensure **subscriptions** are persisted (e.g. volume in Docker or a durable path for `SUBSCRIPTIONS_FILE`) so user subscriptions survive restarts.
