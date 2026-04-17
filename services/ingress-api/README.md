# Ingress API (Gateway)

The **Ingress API** is a serverless Azure Functions service that serves as the front door to the Capture Automation Platform. It provides RESTful endpoints for submitting capture jobs and polling for status updates.

## 🚀 Core Responsibilities

* **Job Ingestion:** Validates incoming requests and enqueues them for background processing via the `browser-orchestrator`.
* **State Management:** Initializes job metadata in Azure Table Storage.
* **Status Polling:** Provides clients with real-time updates on job progression.
* **Secure Delivery:** Generates short-lived SAS (Shared Access Signature) URLs for secure download of completed capture artifacts.

## 🏗️ Architecture

The service leverages Azure Functions HTTP triggers for scale-to-zero capabilities and uses the shared `@capture-automation-platform/azure-adapters` package to communicate with the platform's central storage resources.

* **`POST /api/capture`**: Validates request parameters and drops a message into the `jobs` queue. Returns a `202 Accepted` with a tracking `jobId`.
* **`GET /api/status/{jobId}`**: Looks up the job in Table storage. If completed, it generates a SAS URL for the resulting blob.
* **`GET /api/download/{jobId}`**: Convenience endpoint that looks up a completed job and issues a `302 Redirect` directly to the SAS URL.

## 🛠️ Local Development

Local development is orchestrated from the project root using **PM2** and **Azurite**.

### Commands (Run from Project Root)

| Command | Description |
| :--- | :--- |
| `npm run azurite:up` | Starts Azurite and initializes the metadata table and capture queues. |
| `npm run start` | Starts the Ingress API and Worker in the background via PM2. |
| `npm run start:ingress` | Starts only the Ingress API in the background via PM2. |
| `npm run teardown` | Shuts down the API, worker, and all associated background infrastructure. |

### Manual Workspace Testing
You can run the API's unit tests in isolation using `tsx`:

```bash
# Navigate to the workspace (or use --workspace from root)
npm test --workspace @capture-automation-platform/ingress-api
```

