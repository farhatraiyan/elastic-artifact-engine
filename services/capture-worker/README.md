# Capture Worker Service

The **Capture Worker** is the core rendering engine of the platform. It uses Playwright to perform high-fidelity web captures and uses Azure Storage (Queue, Table, Blob) for its operational lifecycle.

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
npm run services:up
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

Run these from the service root (`services/capture-worker/`):

| Command | Description |
| :--- | :--- |
| `npm run build` | Compiles the worker (`dist/`) and scripts (`dist-dev/`). |
| `npm run dev` | Starts the worker in development mode with interactive CLI. |
| `npm run start` | Starts the compiled worker. |
| `npm run services:up` | Starts local infrastructure (Azurite) via Docker Compose in `docker/dev`. |
| `npm run services:down` | Stops local infrastructure. |
| `npm run test` | Runs all tests with automated Azurite lifecycle management. |
| `npm run lint` | Runs ESLint. |

## 🐳 Docker Deployment

To run the capture-worker with its built-in Azurite instance (all-in-one local environment):

```bash
docker build -t capture-worker -f services/capture-worker/docker/dev/Dockerfile .
docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 -e AZURE_STORAGE_CONNECTION_STRING="UseDevelopmentStorage=true" capture-worker
```

## ☁️ Cloud Smoke Testing (ACA)

If you have deployed the all-in-one container (Worker + Azurite) to **Azure Container Apps**, you can connect your local `dev-cli` to the remote Azurite instance for smoke testing using a secure tunnel.

### 1. Open the Tunnel
Run this command in a separate terminal to map the remote Azurite ports to your local machine:

```bash
az containerapp port-forward \
  --name <APP_NAME> \
  --resource-group <RESOURCE_GROUP> \
  --match-local-port
```

### 2. Run the Ingress CLI
Since the tunnel maps the remote ports to `localhost`, you can use your local `dev-cli` without any configuration changes:

```bash
# In a new terminal
npm run ingress -- "https://example.com" pdf
```

Your local CLI will now push jobs to the cloud-hosted Azurite Queue, which the remote Worker will pick up and process. Output files will be saved locally to `scripts/output/`.

