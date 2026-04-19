# browser-orchestrator — Playwright/Chromium worker image for Azure Container Apps.
#
# Design notes (why this Dockerfile looks the way it does):
#
# - Multi-stage build: the builder stage compiles TypeScript and installs the
#   full dependency set; the final stage only carries compiled artifacts and
#   the runtime deps needed to execute them.
# - Dependency pruning: typescript, tsx, eslint, @typescript-eslint, and @types
#   are removed from the final image layer — they're build-time only.
# - Playwright deps: minimal Linux libs for Chromium are pre-installed via
#   apt-get plus `npx playwright install --with-deps chromium`, so no runtime
#   download when the container starts.
# - Direct exec-form ENTRYPOINT: `["node", "services/browser-orchestrator/dist/index.js"]`
#   makes node PID 1, which handles SIGTERM/SIGINT correctly (Node 14+) without
#   a shell wrapper or tini. An earlier `docker-entrypoint.sh` was dropped once
#   its only remaining work was an `echo` + `exec node` — at that point it was
#   pure ceremony and introduced a shell-interpreter dependency on the slim
#   image (node:20-slim doesn't ship with bash).

# Stage 1: Builder
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace configuration and manifests
COPY package*.json ./
COPY tsconfig.base.json ./
COPY services/browser-orchestrator/package.json ./services/browser-orchestrator/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/azure-adapters/package.json ./packages/azure-adapters/

# Install all dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY scripts ./scripts
COPY packages/shared-types ./packages/shared-types
COPY packages/azure-adapters ./packages/azure-adapters
COPY services/browser-orchestrator ./services/browser-orchestrator

# Build shared types, adapters, and the worker
RUN npm run build --workspace @capture-automation-platform/shared-types
RUN npm run build --workspace @capture-automation-platform/azure-adapters
RUN npm run build --workspace @capture-automation-platform/browser-orchestrator

# Stage 2: Final Image
FROM node:20-slim

WORKDIR /app

# Install minimal Chromium dependencies and the binary via playwright
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && npx playwright install --with-deps chromium \
    && apt-get purge -y --auto-remove \
    && rm -rf /var/lib/apt/lists/*

# Copy artifacts from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/browser-orchestrator/package.json ./services/browser-orchestrator/
COPY --from=builder /app/services/browser-orchestrator/dist ./services/browser-orchestrator/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/azure-adapters/package.json ./packages/azure-adapters/
COPY --from=builder /app/packages/azure-adapters/dist ./packages/azure-adapters/dist

# Selective Pruning of high-bloat devDependencies
RUN rm -rf \
    node_modules/typescript \
    node_modules/tsx \
    node_modules/eslint \
    node_modules/@typescript-eslint \
    node_modules/@types

# Default Environment Variables (Expects Azurite or real Azure to be provided via ENV)
ENV AZURE_STORAGE_CONNECTION_STRING="UseDevelopmentStorage=true"
ENV AZURE_STORAGE_BLOB_CONTAINER_NAME="captures"
ENV AZURE_STORAGE_QUEUE_NAME="jobs"
ENV AZURE_STORAGE_TABLE_NAME="metadata"
ENV CONCURRENCY=2
ENV ENABLE_CLI=false

# Start the worker. Direct exec form makes node PID 1 so it receives SIGTERM/SIGINT
# directly — Node 14+ handles these correctly without a shell wrapper or tini.
ENTRYPOINT ["node", "services/browser-orchestrator/dist/index.js"]
