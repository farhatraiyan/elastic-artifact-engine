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

# Copy entrypoint script
COPY docker/browser-orchestrator/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

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

# Start the worker
ENTRYPOINT ["./docker-entrypoint.sh"]
