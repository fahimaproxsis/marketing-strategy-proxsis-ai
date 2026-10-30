# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install native build tools needed for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy compiled node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY server.js     ./
COPY index.html    ./

# Persistent data directory (mount a volume here in production)
RUN mkdir -p data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
