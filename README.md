# Capture Automation Platform

Cloud-native browserless web capture service for high-scale automation workflows. Leverages containerized Playwright instances to extract intelligent data.

## 🏗️ Architecture

Implements the **Asynchronous Request-Reply** pattern with queue-based load leveling to manage headless browser clusters at scale.

* **Decoupled Ingestion:** Immediate acknowledgment via HTTP Ingress; background processing via Queue Storage.
* **Stable Execution:** Containerized Playwright ensures identical rendering environments.
* **Scale-to-Zero:** Deployed on Azure Container Apps (ACA) with KEDA queue-length scaling.
* **Markdown Extraction:** Mozilla Readability integration for clean, LLM-optimized content.

[View Architecture Diagram](https://github.com/farhatraiyan/capture-automation-platform/blob/main/docs/architecture.png)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/architecture-light.png">
  <img alt="System Architecture Diagram" src="docs/architecture-light.png">
</picture>

## 📂 Structure

```text
/capture-automation-platform
├── .github/workflows/         # CI/CD: QA pipelines
├── infrastructure/            # Azure Bicep IaC modules
├── packages/                  # Shared Logic/Types
│   ├── azure-adapters/        # Shared Azure infrastructure logic
│   └── shared-types/          # Shared job and status schemas
├── scripts/                   # Dev tooling
├── services/                  # Microservices
│   ├── browser-orchestrator/  # Playwright capture worker (ACA)
│   └── ingress-api/           # HTTP gateway (AFA)
└── web/                       # Manual submission UI (planned)
```

## 🛠️ Tech Stack

* **Language:** TypeScript (Node.js 20+)
* **Automation:** Playwright (Chromium)
* **Compute:** Azure Container Apps (Worker), Azure Functions (Ingress)
* **Storage:** Azure Blob (Output), Azure Queue (Jobs), Azure Table (Metadata)
* **DevOps:** Docker, Azure Bicep, GitHub Actions

## 🚦 Status

- [X] **Shared Type System**: Unified Zod contracts.
- [X] **Core Worker Engine**: Playwright + Azure Storage adapters.
- [X] **Containerization**: Playwright Docker image.
- [X] **HTTP Ingress (AFA)**: Job submission and polling.
- [X] **IaC**: Bicep modules for Identity, Storage, ACR, Functions, and ACA.
- [X] **Identity**: `DefaultAzureCredential` adapter migration.
- [ ] **Web UI**: Dashboard for submission/inspection.

## 💻 Local Development

### Prerequisites
- Node.js v20+
- Docker
- Playwright: `npx playwright install chromium`

### Setup
```bash
npm install --legacy-peer-deps
npm run build
```

## 🏃 Commands

| Command | Description |
| :--- | :--- |
| `npm run azurite:up` | Starts Azurite and initializes storage resources. |
| `npm run start` | Starts background services (Ingress + Worker) via PM2. Requires Azurite. |
| `npm run ingress --workspace @capture-automation-platform/browser-orchestrator -- <url> [type]` | Submits a capture job via CLI. |
| `npx pm2 status` | View service status. |
| `npx pm2 logs` | Tail service logs. |
| `npm run teardown` | Stops PM2 services and Azurite. |
| `npm test --workspace <name>` | Runs isolated workspace tests. |
| `npm run test:platform` | Runs E2E integration tests. |

## ☁️ Cloud Deployment

See [`infrastructure/README.md`](infrastructure/README.md) for Azure deployment instructions.