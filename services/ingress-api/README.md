# Ingress API (Gateway)

Serverless Azure Functions service acting as the front door to the Elastic Artifact Engine.

## 🚀 Capabilities

* **Job Ingestion:** Validates and enqueues requests (`browser-orchestrator`).
* **State Management:** Initializes tracking in Azure Table Storage.
* **Status Polling:** Real-time lookup of job state.
* **Secure Delivery:** Generates short-lived SAS URLs for secure artifact access.

## 🏗️ Architecture

Leverages Azure Functions HTTP triggers for scale-to-zero capabilities.

* **`POST /api/render`**: Enqueues job. Returns `202 Accepted` with `jobId`.
* **`GET /api/status/{jobId}`**: Table storage lookup. Generates SAS URL if complete.
* **`GET /api/download/{jobId}`**: Convenience endpoint issuing `302 Redirect` to SAS URL.

## 🛠️ Commands

_Execute from workspace root: `npm run <script> --workspace @elastic-artifact-engine/ingress-api`_

| Command | Description |
| :--- | :--- |
| `npm run build` | Compiles source. |
| `npm run bundle` | ESBuild pipeline for function deployment package. |
| `npm run lint` | Lints source and tests. |
| `npm test` | Executes workspace tests via `tsx`. |

_Project Root Commands:_
* `npm run azurite:up`: Start local emulator.
* `npm run start:ingress`: PM2 background launch (API only).
* `npm run start`: PM2 background launch (API + Worker).