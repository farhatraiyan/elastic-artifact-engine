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

### 🏗️ System Architecture

[Click here to view full resolution](https://github.com/farhatraiyan/capture-automation-platform/blob/main/docs/architecture.png)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/architecture-light.png">
  <img alt="System Architecture Diagram" src="docs/architecture-light.png">
</picture>

## 📂 Project Structure

```text
/capture-automation-platform
├── .github/workflows/         # CI/CD: QA pipelines
├── infrastructure/            # IaC (Azure Bicep modules + deploy docs)
│   ├── identity.bicep         # User-Assigned Managed Identity
│   ├── storage.bicep          # Storage Account + container/queue/table + data-plane roles
│   ├── registry.bicep         # Azure Container Registry + AcrPull role
│   ├── functions.bicep        # Flex Consumption Function App (ingress-api shell)
│   ├── containerapp.bicep     # ACA Environment + Container App (browser-orchestrator)
│   └── README.md              # Deployment commands, verification, teardown
├── packages/                  # Shared Logic/Types
│   ├── azure-adapters/        # Shared Azure infrastructure logic
│   └── shared-types/          # Shared job and status interfaces
├── scripts/                   # Dev + deployment tooling
│   ├── setup-azurite.ts       # Bootstrap local Azurite container/queue/table
│   └── stage-ingress-api.sh   # Bundle ingress-api
├── services/                  # Backend Microservices
│   ├── browser-orchestrator/  # Playwright-based capture service (ACA)
│   └── ingress-api/           # HTTP Ingress (AFA)
└── web/                       # UI for manual job submission (planned)
```

---

## 🛠️ Tech Stack

* **Language:** TypeScript (Node.js 20+)
* **Browser Automation:** Playwright (Chromium)
* **Cloud Provider:** Microsoft Azure
  * **Compute:** Azure Container Apps (Worker), Azure Functions (Ingress)
  * **Storage:** Azure Blob Storage (Output), Azure Queue Storage (Jobs), Azure Table Storage (Metadata)
* **DevOps:** Docker, Azure Bicep, GitHub Actions

---

## 🚦 Current Status & Roadmap

The core processing engine is functional and the platform has been deployed end-to-end to Azure with a working capture pipeline.

- [X] **Shared Type System**: Unified contracts for job orchestration.
- [X] **Core Worker Engine**: Playwright orchestration and Azure Storage adapters.
- [X] **Containerization**: Optimized Docker image with Playwright dependencies.
- [X] **HTTP Ingress (AFA)**: Azure Functions-based entry point for job submission and status polling.
- [X] **Infrastructure-as-Code**: Bicep modules for identity, storage, ACR, Functions (Flex Consumption), and Container Apps.
- [X] **Adapter migration to `DefaultAzureCredential`**: deployed storage account is identity-only.
- [ ] **Web UI**: A modern dashboard for manual job submission and visual result inspection.

---

## 💻 Getting Started

### Prerequisites
- Node.js v20+
- Docker
- Playwright: `npx playwright install chromium`

### Setup

```bash
npm install --legacy-peer-deps
npm run build
```

## 🏃 Running the Platform

### 1. Infrastructure (Azurite)
Starts Azurite (via Docker), waits for ports, and automatically initializes the required containers, queues, and tables.

```bash
npm run azurite:up
```

### 2. Background Services (PM2)
Requires Azurite.
```bash
npm run start
```

### 3. Submit Jobs (CLI)
```bash
npm run ingress --workspace @capture-automation-platform/browser-orchestrator -- <url> [type]
```

### 4. Monitor & Teardown
```bash
# View status of all services
npx pm2 status

# Tail logs for all services
npx pm2 logs

# Stop all background services
npm run teardown
```

## ☁️ Cloud Deployment

See [`infrastructure/README.md`](infrastructure/README.md) for Azure deployment instructions (Bicep modules, image publishing, and teardown).

## 🧪 Testing

### Workspace Tests
```bash
npm test --workspace @capture-automation-platform/azure-adapters
```

### Platform Integration Tests
```bash
npm run test:platform
```