# Capture Automation Platform

A high-scale, cloud-native browserless web capture service designed for complex automation workflows. This platform provides a robust foundation for capturing, processing, and extracting intelligent data from the web using containerized Playwright instances.

## Overview

The Capture Automation Platform is built to handle the "thundering herd" problem and resource-intensive nature of headless browser clusters. It leverages an **Asynchronous Request-Reply** pattern with queue-based load leveling to ensure reliability and scalability, making it ideal for large-scale data extraction and archival tasks.

### Key Architectural Pillars

* **Asynchronous Request-Reply Pattern:** Decouples request ingestion from intensive processing, providing immediate acknowledgment while background workers handle the capture.
* **Queue-Based Load Leveling:** Utilizes Azure Queue Storage to buffer spikes in traffic, protecting downstream resources and ensuring consistent performance.
* **Containerized Playwright Environment:** Ensures identical execution environments for browser automation, eliminating client-side rendering inconsistencies and providing a stable platform for complex document rendering.
* **Scale-to-Zero Compute:** Designed for deployment on Azure Container Apps (ACA), allowing the browser orchestrator to scale dynamically based on queue depth, including scaling to zero to minimize idle costs.
* **Intelligent Markdown Extraction:** Integrates Mozilla's Readability library to extract clean, structured markdown from complex web pages, optimized for LLM consumption and archival.

---

## 🏗️ Architecture

The platform follows a microservices-inspired architecture managed within a TypeScript monorepo.

```mermaid
graph TD
    Client[Automation Client] -->|HTTP POST| Ingress[HTTP Ingress - Azure Functions]
    Ingress -->|Enqueue Job| Queue[Azure Queue Storage]
    Ingress -->|Initialize Metadata| Table[Azure Table Storage]
  
    subgraph "Compute Layer (ACA)"
        Worker[Browser Orchestrator Worker]
    end
  
    Queue -->|Dequeue| Worker
    Worker -->|Execute| Playwright[Playwright / Chromium]
    Worker -->|Store Result| Blob[Azure Blob Storage]
    Worker -->|Update Status| Table
  
    Client -->|Poll Status| Ingress
    Ingress -->|Query Metadata| Table
```

## 📂 Project Structure

```text
/capture-automation-platform
├── .github/workflows/         # CI/CD: QA and deployment pipelines (planned)
├── infrastructure/            # IaC (Azure Resources)
│   ├── acr.bicep              # Azure Container Registry deployment
│   └── README.md              # Infrastructure documentation
├── packages/                  # Shared Logic/Types
│   ├── azure-adapters/        # Shared Azure infrastructure logic
│   └── shared-types/          # Shared job and status interfaces
├── services/                  # Backend Microservices
│   └── browser-orchestrator/  # Playwright-based capture service (ACA)
│   └── ingress-api/           # HTTP Ingress (AFA)
└── web/                       # UI for manual job submission
```

---

## 🛠️ Tech Stack

* **Language:** TypeScript (Node.js 20+)
* **Browser Automation:** Playwright (Chromium)
* **Cloud Provider:** Microsoft Azure
  * **Compute:** Azure Container Apps (Worker), Azure Functions (Ingress - *WIP*)
  * **Storage:** Azure Blob Storage (Output), Azure Queue Storage (Jobs), Azure Table Storage (Metadata)
* **DevOps:** Docker, Azure Bicep, GitHub Actions

---

## 🚦 Current Status & Roadmap

The project is currently in active development. The core processing engine is functional, and the platform is being prepared for its first full cloud deployment.

- [X] **Shared Type System**: Unified contracts for job orchestration.
- [X] **Core Worker Engine**: Playwright orchestration and Azure Storage adapters.
- [X] **Containerization**: Optimized Docker image with Playwright dependencies.
- [ ] **HTTP Ingress (AFA)**: Azure Functions-based entry point for job submission and status polling.
- [ ] **Infrastructure-as-Code**: Complete Bicep templates for ACA/AFA/Storage deployment.
- [ ] **Web UI**: A modern dashboard for manual job submission and visual result inspection.

---

## 💻 Getting Started (Local Development)

The platform is designed to be easily testable locally using Azurite for Azure Storage emulation.

### Prerequisites

- **Node.js**: v20+
- **Docker**: Required for Azurite storage emulation and containerized worker testing.
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

## 🏃 Running the Platform

The platform is designed to be easily testable locally using Azurite for Azure Storage emulation and **PM2** for background process management.

### 1. Start Infrastructure (Azurite)
Starts Azurite (via Docker), waits for ports, and automatically initializes the required containers, queues, and tables.

```bash
npm run azurite:up
```

### 2. Start Background Services
Launches the Ingress API and the Browser Orchestrator worker in the background using PM2. Requires Azurite to be running.

```bash
npm run start
```

### 3. Submit Jobs (CLI)
While the platform is running, submit jobs using the dev CLI:

```bash
npm run ingress --workspace @capture-automation-platform/browser-orchestrator -- <url> [type]
```

Example: `npm run ingress --workspace @capture-automation-platform/browser-orchestrator -- https://example.com pdf`

### 4. Monitor & Logs
Since services run in the background, use PM2 to monitor them:

```bash
# View status of all services
npx pm2 status

# Tail logs for all services
npx pm2 logs

# Stop all background services
npm run teardown
```

## 🧪 Testing

The platform uses a decoupled testing strategy where tests run directly against source files using `tsx`.

### 1. Workspace Tests
Run isolated unit and integration tests for a specific workspace:

```bash
# Run tests for a workspace
npm test --workspace @capture-automation-platform/azure-adapters
```

### 2. Platform Integration Tests
Runs the full end-to-end integration suite across all services:

```bash
npm run test:platform
```