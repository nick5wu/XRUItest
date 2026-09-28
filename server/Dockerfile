# ==========================================
# Multi-stage Dockerfile for Cloud Run
# ==========================================

# Stage 1: Build TypeScript Code
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
RUN npm ci

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# Stage 2: Production Execution Environment
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

# Non-root user for cloud security
USER node

# Cloud Run defaults to PORT 8080
EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/server.js"]
