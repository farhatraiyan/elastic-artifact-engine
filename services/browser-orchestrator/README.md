# Browser Orchestrator (Capture Worker)

The **Browser Orchestrator** is a specialized Node.js worker service responsible for the lifecycle of web capture jobs. It leverages Playwright to orchestrate headless browser instances and implements a decoupled, adapter-based architecture to interface with Azure cloud services.

## 🚀 Core Responsibilities

* **Job Orchestration:** Listens to an Azure Storage Queue for incoming `CaptureJob` messages.
* **Browser Management:** Manages Chromium instances via Playwright, ensuring fresh contexts for every job to prevent state leakage.
* **Multi-Format Capture:** Supports high-fidelity PDF, PNG (Full Page), and intelligent Markdown extraction.
* **Result Persistence:** Uploads captured artifacts to Azure Blob Storage and updates job metadata in Azure Table Storage.
* **Fault Tolerance:** Implements adaptive backoff for queue polling and graceful shutdown to ensure in-flight jobs are safely abandoned for retry.

## ✨ Key Features

* **Intelligent Reader Mode:** Integrates Mozilla's `Readability` library to extract clean, article-focused Markdown, optimized for LLM processing.
* **UI Friction Handling:** Automatically attempts to dismiss cookie banners and consent overlays before capture.
* **Heuristic Content Discovery:** Uses fallback selectors to ensure successful Markdown extraction even when Readability fails.
* **Concurrency Control:** Configurable parallel job processing to maximize resource utilization on Azure Container Apps.
* **Auto-Scrolling:** Simulates user scrolling to trigger lazy-loaded images and dynamic content hydration.

## 🏗️ Architecture

The service follows a strict interface-driven design. It leverages the shared infrastructure package for Azure interactions, keeping the worker focused on orchestration and capture logic.

* **`Worker`**: The central engine that coordinates between the Queue, Capture, and Storage services.
* **`PlaywrightAdapter`**: Encapsulates all browser-specific logic, including custom Turndown rules for GFM-compatible Markdown.
* **`Azure Adapters`**: Integrated from `@capture-automation-platform/azure-adapters` for Blob, Queue, and Table storage.

## 🛠️ Local Development

### Prerequisites

* **Azurite:** Required for local storage emulation.
* **Docker:** Recommended for running Azurite via the provided compose file.

### Commands

Note: Full platform orchestration (Azurite, API, Docker) has been moved to the project root.

| Command                    | Description                                                                                |
| :------------------------- | :----------------------------------------------------------------------------------------- |
| `npm run build`          | Compiles the core TypeScript source (`src`) for the worker.                                |
| `npm run dev`            | Starts the worker locally using `tsx` (assumes Azurite is running via root `azurite:up`).  |
| `npm run ingress`        | Runs the Dev CLI to submit test jobs (e.g.,`npm run ingress -- https://example.com pdf`).  |
| `npm run start`          | Launches the worker in the background via PM2.                                             |
| `npm run orchestrator:docker:run` | Launches the worker via a Docker container on the host network.                   |
| `npm test`               | Executes isolated workspace tests directly from source using `tsx`.                       |

## ⚙️ Configuration

The service is configured via environment variables. Storage auth is mode-switched: if `AZURE_STORAGE_ACCOUNT_NAME` is set the worker uses `DefaultAzureCredential` (deployed posture); otherwise it falls back to `AZURE_STORAGE_CONNECTION_STRING` (local + CI against Azurite).

| Variable                              | Default                        | Description                                                           |
| :------------------------------------ | :----------------------------- | :-------------------------------------------------------------------- |
| `AZURE_STORAGE_ACCOUNT_NAME`        | _(unset)_                    | When set, switches storage auth to `DefaultAzureCredential` and derives blob/queue/table URLs from this account name. Set in deployed environments. |
| `AZURE_CLIENT_ID`                   | _(unset)_                    | UAMI client ID. Required alongside `AZURE_STORAGE_ACCOUNT_NAME` so `DefaultAzureCredential` picks the right managed identity. |
| `AZURE_STORAGE_CONNECTION_STRING`   | `UseDevelopmentStorage=true` | Connection string for Azure Storage. Used only when `AZURE_STORAGE_ACCOUNT_NAME` is unset (local + CI). |
| `CONCURRENCY`                       | `2`                          | Number of simultaneous capture jobs per worker instance.              |
| `MAX_RETRIES`                       | `5`                          | Maximum number of times a job can be dequeued before being discarded. |
| `AZURE_STORAGE_BLOB_CONTAINER_NAME` | `captures`                   | Destination container for output files.                               |
| `AZURE_STORAGE_QUEUE_NAME`          | `jobs`                       | Source queue for capture requests.                                    |
| `AZURE_STORAGE_TABLE_NAME`          | `metadata`                   | Table name for job status tracking.                                   |

## 🧪 Testing

* **Unit Tests:** Located in `tests/Worker.test.ts`, uses mocks to verify orchestration logic.
* **Adapter Tests:** `tests/PlaywrightAdapter.test.ts` verifies browser behavior against data URLs.
* **Integration Tests:** `tests/Integration.test.ts` runs a full end-to-end flow from queue ingestion to blob storage using Azurite.
