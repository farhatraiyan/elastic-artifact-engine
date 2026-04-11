# Cloud-Native Capture Automation Platform

**Status:** Phase 2.0 - Unified Azure-Ready Worker
**Architecture:** Azure (Container Apps, Storage Queues, Table Metadata, Blob Storage)
**Stack:** TypeScript, Playwright, Node.js, Azurite

## 🚀 Overview

A full-stack platform for high-fidelity web captures (PDF/Screenshot/Markdown). This project demonstrates a production-grade **Event-Driven Architecture (EDA)** that handles long-running browser automation tasks asynchronously using Azure Storage primitives.

### Core Objectives

- **Protocol Parity:** Uses Azurite locally to ensure identical behavior between dev and production.
- **Operational Excellence:** Unified codebase for all environments via environment-variable driven adapters.
- **Scale-to-Zero:** A "Zero-Dollar Idle" footprint using Azure Container Apps.

## 🏗️ Monorepo Structure

The project uses NPM Workspaces to manage services and shared packages:

- **[`/services/browser-orchestrator`](./services/browser-orchestrator)**: The core rendering engine (Playwright). Unified Azure SDK-based architecture for all environments.
- **[`/packages/shared-types`](./packages/shared-types)**: Unified Zod-backed types and schemas used across the system.
- **[`/infrastructure`](./infrastructure)**: Bicep-based IaC for Azure provisioning.

## 🛠️ Getting Started (New Developers)

### Prerequisites

- **Node.js**: v20+
- **Azurite**: Required for local storage/queue emulation.
  - Recommended: `npm run services:up --workspace @capture-automation-platform/browser-orchestrator`
  - Manual: `docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite --skipApiVersionCheck`
- **Playwright Browsers**: `npx playwright install chromium`

### Installation

Due to a temporary peer dependency conflict with TypeScript 6.0 and `@typescript-eslint`, you **must** use the legacy peer deps flag:

```bash
npm install --legacy-peer-deps
```

### Initial Build

Always build the shared types first, as all other services depend on them:

```bash
# Build everything
npm run build
```

## 🏃 Running the System

The project uses a unified **Azurite-backed** workflow:

1. **Start Azurite**:
   ```bash
   npm run services:up --workspace @capture-automation-platform/browser-orchestrator
   ```
2. **Start Worker**:
   ```bash
   npm run dev --workspace @capture-automation-platform/browser-orchestrator
   ```
3. **Submit Jobs (CLI)**:
   ```bash
   npm run ingress --workspace @capture-automation-platform/browser-orchestrator -- <url> [type]
   ```

   Example: `npm run ingress --workspace @capture-automation-platform/browser-orchestrator -- https://example.com pdf`

## ✅ Quality Standards

- **Linting**: `npm run lint`
- **Testing**: `npm test` (requires Azurite for integration tests)

## 🗺️ Phase Roadmap

1. **Phase 1 (Worker Core):** ✅ Core browser logic, Playwright integration, Markdown support.
2. **Phase 2 (Azure Integration):** ✅ Azurite onboarding, Unified Azure SDK adapters, DLQ/Poison handling.
3. **Phase 3 (Infrastructure):** 🏗️ Service Bus migration (optional), Bicep for Container Apps.
4. **Phase 4 (SignalR & Frontend):** 🏗️ Real-time status broadcasting and React dashboard.

---

**Author:** Ryan (Updated April 2026)
