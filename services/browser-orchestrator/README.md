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

| Command                    | Description                                                                                |
| :------------------------- | :----------------------------------------------------------------------------------------- |
| `npm run services:up`    | Starts local Azurite container.                                                            |
| `npm run services:setup` | Initializes the required containers, queues, and tables in Azurite.                        |
| `npm run build`          | Compiles the TypeScript source for the worker and scripts.                                 |
| `npm run dev`            | Starts the worker in development mode (pointing to local Azurite).                         |
| `npm run ingress`        | Runs the Dev CLI to submit test jobs (e.g.,`npm run ingress -- https://google.com pdf`). |
| `npm run test`           | Executes unit and integration tests (automatically manages Azurite lifecycle).             |

## ⚙️ Configuration

The service is configured via environment variables:

| Variable                              | Default                        | Description                                                           |
| :------------------------------------ | :----------------------------- | :-------------------------------------------------------------------- |
| `AZURE_STORAGE_CONNECTION_STRING`   | `UseDevelopmentStorage=true` | Connection string for Azure Storage.                                  |
| `CONCURRENCY`                       | `2`                          | Number of simultaneous capture jobs per worker instance.              |
| `MAX_RETRIES`                       | `5`                          | Maximum number of times a job can be dequeued before being discarded. |
| `AZURE_STORAGE_BLOB_CONTAINER_NAME` | `captures`                   | Destination container for output files.                               |
| `AZURE_STORAGE_QUEUE_NAME`          | `jobs`                       | Source queue for capture requests.                                    |
| `AZURE_STORAGE_TABLE_NAME`          | `metadata`                   | Table name for job status tracking.                                   |

## 🧪 Testing

* **Unit Tests:** Located in `tests/Worker.test.ts`, uses mocks to verify orchestration logic.
* **Adapter Tests:** `tests/PlaywrightAdapter.test.ts` verifies browser behavior against data URLs.
* **Integration Tests:** `tests/Integration.test.ts` runs a full end-to-end flow from queue ingestion to blob storage using Azurite.
