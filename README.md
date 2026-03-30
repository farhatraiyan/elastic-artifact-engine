# Cloud-Native Browserless SaaS Platform (Render Engine)

**Status:** Phase 1.1 - Local Execution & EDA Foundation  
**Architecture:** Azure (SWA, Container Apps, Service Bus, SignalR)  
**Stack:** TypeScript, Playwright, Node.js

## 🚀 Overview

A full-stack, "Personal SaaS" platform designed for high-fidelity web captures (PDF/Screenshot). This project demonstrates a production-grade **Event-Driven Architecture (EDA)** that handles long-running browser automation tasks asynchronously.

### Core Objectives
- **Decoupled Real-Time Architecture:** Transitioning from client-side polling to SignalR for real-time job status.
- **Operational Excellence:** Full environment automation via Bicep/IaC and GitHub Actions.
- **Scale-to-Zero:** A "Zero-Dollar Idle" footprint using Azure Container Apps.

## 🏗️ Monorepo Structure

- `/services/capture-worker`: The core rendering engine (Playwright).
- `/services/packages/shared-types`: Unified Zod-backed types and schemas.
- `/docs`: Architectural diagrams and project proposals.

## 🛠️ Local Development (Phase 1.1)

Before moving to Azure, you can run the system locally using file-based mocks for the queue and storage.

### Prerequisites
- Node.js v20+
- Playwright Browsers: `npx playwright install chromium`

### Setup
```bash
npm install
# Build shared types first
npm run build --workspace @render-engine/shared-types
# Build the local worker for type-checking and testing
npm run build:local --workspace @render-engine/capture-worker
```

### Running the Worker
```bash
cd services/capture-worker
npm run dev
```

### Seeding Jobs
In a separate terminal:
```bash
# Seed default samples (Google, GitHub, Wikipedia)
npm run seed:local --workspace @render-engine/capture-worker

# Or seed a custom URL
npm run seed:local --workspace @render-engine/capture-worker -- https://bing.com screenshot
```

Captured files will appear in `services/capture-worker/output/`.

## ✅ Quality Standards

The project enforces strict linting and automated testing:
- **Linting**: `npm run lint --workspaces`
- **Testing**: `npm run test:local --workspace @render-engine/capture-worker`

## ⚠️ Maintenance & Technical Debt

- **TypeScript 6.0 Compatibility**: Currently, `npm install` requires the `--legacy-peer-deps` flag. This is because `@typescript-eslint` (v8.x) has a peer dependency range that ends at `<6.0.0`. 
  - **Action**: Once a version of `@typescript-eslint` supporting TS 6.0+ is released, update the root `devDependencies` and remove the need for this flag.

## 🗺️ Phase Roadmap

1. **Phase 1 (Worker):** ✅ Core browser logic with local adapters.
2. **Phase 2 (Azure Prep):** 🏗️ Service Bus, Blob Storage, and Infrastructure as Code (Bicep).
3. **Phase 3 (Real-Time):** Connect SignalR Hub for live job broadcasting.
4. **Phase 4 (Frontend):** Build the React/SWA dashboard.
5. **Phase 5 (Governance):** Cost management and blob lifecycle policies.

---
**Author:** Ryan (March 2026)
