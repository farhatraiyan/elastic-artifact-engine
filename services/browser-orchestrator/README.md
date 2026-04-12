# Browser Orchestrator Service

The **Browser Orchestrator** is the core rendering engine of the platform. It uses Playwright to perform high-fidelity web captures and uses Azure Storage (Queue, Table, Blob) for its operational lifecycle.

## ✨ Features

- **High-Fidelity Captures**: Supports PDF, PNG (Screenshot), and Markdown.
- **Smart Markdown Extraction**:
  - **Reader Mode (Default)**: Uses `@mozilla/readability` to extract the main article content.
  - **Raw Mode**: Full page HTML-to-Markdown conversion.
- **Pre-Capture Optimization**: Auto-scrolling, banner dismissal, and custom CSS injection.
- **Unified Architecture**: Same code for Local (via Azurite) and Production (via Azure).

## 🏗️ Architecture

The worker follows a decoupled, adapter-based architecture:

- **Core Engine (`src/core/Worker.ts`)**: Orchestrates the job lifecycle.
- **Capture Adapter (`src/adapters/PlaywrightAdapter.ts`)**: Browser-based rendering.
- **Azure Adapters (`src/adapters/Azure*`)**: Production-ready implementations for Azure Storage.
- **Ingress CLI (`scripts/dev-cli.ts`)**: Developer interface for submitting jobs locally.

## 📂 Directory Structure

| Path | Description |
| :--- | :--- |
| `src/` | Unified source code for the Worker (Adapters, Core). |
| `scripts/` | Developer utilities and ingress CLI. |
| `docker/` | Dockerfiles and Compose configurations for dev/prod. |
| `tests/` | Comprehensive test suite (Unit & Integration). |

## 🛠️ Prerequisites (Local Development)

The worker requires **Azurite** (Azure Storage API emulator) for local development.

### Option A: Docker Compose (Recommended)
```bash
# 1. Start the container
npm run services:up

# 2. Build and initialize (Queue, Blob, Table)
npm run build
npm run services:setup
```

### Option B: Docker (Manual)
```bash
docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite --skipApiVersionCheck
```

### Option C: npm
```bash
npm install -g azurite
azurite --silent --location ./data --debug ./data/debug.log --skipApiVersionCheck
```

## ⚙️ Configuration

| Variable | Description | Default |
| :--- | :--- | :--- |
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string for Azure or Azurite. | `UseDevelopmentStorage=true` |
| `AZURE_STORAGE_BLOB_CONTAINER_NAME` | Name of the Blob container for captures. | `captures` |
| `AZURE_STORAGE_QUEUE_NAME` | Name of the Queue for jobs. | `jobs` |
| `AZURE_STORAGE_TABLE_NAME` | Name of the Table for metadata. | `metadata` |
| `CONCURRENCY` | Maximum simultaneous jobs. | `2` |
| `ENABLE_CLI` | Enable interactive CLI in TTY. | `true` |

## 🛠️ Key Scripts

Run these from the service root (`services/browser-orchestrator/`):

| Command | Description |
| :--- | :--- |
| `npm run build` | Compiles the worker (`dist/`) and scripts (`dist-dev/`). |
| `npm run dev` | Starts the worker in development mode with interactive CLI. |
| `npm run start` | Starts the compiled worker. |
| `npm run services:up` | Starts local infrastructure (Azurite) via Docker Compose in `docker/dev`. |
| `npm run services:down` | Stops local infrastructure. |
| `npm run test` | Runs all tests with automated Azurite lifecycle management. |
| `npm run lint` | Runs ESLint. |

## 🐳 Docker (Image Testing)

To test the worker image locally against the containerized Azurite instance:

1. **Start Azurite**: `npm run services:up`
2. **Build the Worker**: `docker build -t browser-orchestrator -f services/browser-orchestrator/docker/Dockerfile .`
3. **Run the Worker**:
   ```bash
   docker run --rm \
     --network host \
     -e AZURE_STORAGE_CONNECTION_STRING="UseDevelopmentStorage=true" \
     browser-orchestrator
   ```

Using `--network host` allows the worker container to reach Azurite at `localhost`. You can then use your local `dev-cli` as usual.
