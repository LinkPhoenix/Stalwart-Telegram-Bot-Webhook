# TB Stalwart - Telegram bot + webhook server (Bun)
# Build: docker build -t tb-stalwart:latest .
FROM oven/bun:1-alpine
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source; default subscriptions file (app uses SUBSCRIPTIONS_FILE at runtime, e.g. /app/data/subscriptions.json in Docker)
COPY src ./src
COPY subscriptions.json.default ./subscriptions.json

EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
