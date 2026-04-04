# Cloud-Native Browserless SaaS Platform (Render Engine)

**Status:** Phase 1.2 - Dev Infrastructure & Cloud-Ready Worker  
**Architecture:** Azure (SWA, Container Apps, Service Bus, SignalR)  
**Stack:** TypeScript, Playwright, Node.js

## 🚀 Overview

A full-stack platform for high-fidelity web captures (PDF/Screenshot/Markdown). This project demonstrates a production-grade **Event-Driven Architecture (EDA)** that handles long-running browser automation tasks asynchronously.

### Core Objectives
- **Decoupled Real-Time Architecture:** SignalR for real-time job status broadcasting.
- **Operational Excellence:** Full environment automation via Bicep/IaC and GitHub Actions.
- **Scale-to-Zero:** A "Zero-Dollar Idle" footprint using Azure Container Apps.

## 🏗️ Monorepo Structure

The project uses NPM Workspaces to manage services and shared packages:

- **[`/services/capture-worker`](./services/capture-worker)**: The core rendering engine (Playwright). Includes adapters for local and cloud environments.
- **[`/packages/shared-types`](./packages/shared-types)**: Unified Zod-backed types and schemas used across the system.
- **[`/infrastructure`](./infrastructure)**: Bicep-based IaC for Azure provisioning.

## 🛠️ Getting Started (New Developers)

### Prerequisites
- **Node.js**: v20+
- **Playwright Browsers**: `npx playwright install chromium`
- **Docker**: Required for building dev container images.

### Installation
Due to a temporary peer dependency conflict with TypeScript 6.0 and `@typescript-eslint`, you **must** use the legacy peer deps flag:

```bash
npm install --legacy-peer-deps
```

### Initial Build
Always build the shared types first, as all other services depend on them:

```bash
# Build shared types
npm run build --workspace @render-engine/shared-types

# Build the worker core
npm run build --workspace @render-engine/capture-worker
```

## 🏃 Running the System

The project supports two main development workflows:

1.  **Local MVP (Phase 1.1)**: Runs everything in a single process with file-based mocks. 
    *   See [services/capture-worker/local/README.md](./services/capture-worker/local/README.md).
2.  **Dev/Cloud-Ready (Phase 1.2)**: Split Client/Worker architecture using WebSockets, designed for Azure Container Apps.
    *   See [services/capture-worker/dev/README.md](./services/capture-worker/dev/README.md).

## ✅ Quality Standards

- **Linting**: `npm run lint --workspaces`
- **Testing**:
  - Local tests: `npm run test:local --workspace @render-engine/capture-worker`
  - Dev tests: `npm run test:dev --workspace @render-engine/capture-worker`

## 🗺️ Phase Roadmap

1.  **Phase 1 (Worker):** ✅ Core browser logic, local/dev adapters, Markdown support.
2.  **Phase 2 (Azure Prep):** 🏗️ Service Bus, Blob Storage, and Infrastructure as Code (Bicep).
3.  **Phase 3 (Real-Time):** Connect SignalR Hub for live job broadcasting.
4.  **Phase 4 (Frontend):** Build the React/SWA dashboard.
5.  **Phase 5 (Governance):** Cost management and blob lifecycle policies.

---
**Author:** Ryan (Updated April 2026)
