# Stage 1: Builder
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace configuration and manifests
COPY package*.json ./
COPY tsconfig.base.json ./
COPY services/capture-worker/package.json ./services/capture-worker/
COPY services/packages/shared-types/package.json ./services/packages/shared-types/

# Install all dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY services/packages/shared-types ./services/packages/shared-types
COPY services/capture-worker ./services/capture-worker

# Build shared types and the worker
RUN npm run build --workspace @render-engine/shared-types
RUN npm run build:dev:docker --workspace @render-engine/capture-worker

# Stage 2: Final Dev Image
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
COPY --from=builder /app/services/capture-worker/package.json ./services/capture-worker/
COPY --from=builder /app/services/capture-worker/dist-dev ./services/capture-worker/dist-dev
COPY --from=builder /app/services/packages/shared-types/package.json ./services/packages/shared-types/
COPY --from=builder /app/services/packages/shared-types/dist ./services/packages/shared-types/dist

# Selective Pruning of high-bloat devDependencies from node_modules
# Note: typescript, tsx, eslint, @types/* are in root or worker node_modules
RUN rm -rf \
    node_modules/typescript \
    node_modules/tsx \
    node_modules/eslint \
    node_modules/@typescript-eslint \
    node_modules/@types \
    services/capture-worker/node_modules/async-lock

# Expose the WebSocket port
EXPOSE 3005

# Start the dev worker
CMD ["npm", "run", "dev:worker", "--workspace", "@render-engine/capture-worker"]
