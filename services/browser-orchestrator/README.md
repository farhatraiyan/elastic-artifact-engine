# Browser Orchestrator

Node.js worker service utilizing Playwright for headless web render jobs. Interfaces with Azure services via a decoupled adapter architecture.

## 🚀 Capabilities

* **Orchestration:** Listens to Azure Storage Queue (`RenderJob`).
* **Browser Management:** Fresh Chromium contexts per job via Playwright.
* **Render Formats:** PDF, PNG (Full Page), Markdown (via Readability/Heuristics).
* **Persistence:** Uploads artifacts to Azure Blob Storage; metadata to Azure Table Storage.
* **Resilience:** Adaptive backoff for polling, automatic UI friction handling (cookie banners), auto-scrolling, and graceful shutdown.

## 🏗️ Architecture

* **`Worker`**: Core coordinator between Queue, Render, and Storage.
* **`PlaywrightAdapter`**: Encapsulates browser logic and custom Turndown rules.
* **`Azure Adapters`**: Infrastructure integration (`@elastic-artifact-engine/azure-adapters`).

## 🛠️ Commands

_Execute from workspace root: `npm run <script> --workspace @elastic-artifact-engine/browser-orchestrator`_

| Command | Description |
| :--- | :--- |
| `npm run build` | Compiles source. |
| `npm run dev` | Runs locally via `tsx` (requires Azurite). |
| `npm run ingress` | CLI submission: `npm run ingress -- https://example.com pdf` |
| `npm run start` | PM2 background launch. |
| `npm run orchestrator:docker:run` | Docker host-network launch (from project root). |
| `npm test` | Executes workspace tests via `tsx`. |

## ⚙️ Configuration

Auth mode switches automatically based on the presence of `AZURE_STORAGE_ACCOUNT_NAME`.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `AZURE_STORAGE_ACCOUNT_NAME` | _(unset)_ | Triggers `DefaultAzureCredential` auth mode for deployed environments. |
| `AZURE_CLIENT_ID` | _(unset)_ | UAMI client ID for `DefaultAzureCredential`. |
| `AZURE_STORAGE_CONNECTION_STRING` | `UseDevelopmentStorage=true` | Connection string (fallback for local/Azurite). |
| `CONCURRENCY` | `2` | Max parallel jobs per instance. |
| `MAX_RETRIES` | `5` | Max dequeue attempts before discard. |
| `AZURE_STORAGE_BLOB_CONTAINER_NAME` | `artifacts` | Output blob container. |
| `AZURE_STORAGE_QUEUE_NAME` | `jobs` | Source queue. |
| `AZURE_STORAGE_TABLE_NAME` | `metadata` | Status tracking table. |

## 🧪 Testing

| Suite | Path | Target |
| :--- | :--- | :--- |
| Unit | `tests/Worker.test.ts` | Orchestration logic (mocked). |
| Adapter | `tests/PlaywrightAdapter.test.ts` | Browser behavior via data URLs. |
| Integration | `tests/Integration.test.ts` | Full E2E flow against Azurite. |