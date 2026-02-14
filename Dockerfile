# TB Stalwart - Telegram bot + webhook server (Bun)
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and data files
COPY src ./src
# subscriptions.json may be gitignored; use default empty file (bot creates it at SUBSCRIPTIONS_FILE at runtime)
COPY subscriptions.json.default ./subscriptions.json

# Expose webhook server port
EXPOSE 3000

# Run the server (env vars via docker-compose or runtime)
CMD ["bun", "run", "src/server.ts"]
