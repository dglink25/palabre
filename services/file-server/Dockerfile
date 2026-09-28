FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ── Image finale ─────────────────────────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache tini

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

RUN mkdir -p /data/storage

ENV FILE_STORAGE_PATH=/data/storage
ENV FILE_SERVER_PORT=4030

EXPOSE 4030

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
