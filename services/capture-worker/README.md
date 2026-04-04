# Capture Worker Service

The **Capture Worker** is the core rendering engine of the platform. It uses Playwright to perform high-fidelity web captures and is designed with an adapter-based architecture to support various execution environments.

## ✨ Features

- **High-Fidelity Captures**: Supports PDF, PNG (Screenshot), and Markdown.
- **Smart Markdown Extraction**:
  - **Reader Mode (Default)**: Uses `@mozilla/readability` to extract the main article content, stripping navigation, ads, and footers.
  - **Raw Mode**: Converts the entire page HTML to Markdown using `turndown`.
- **Pre-Capture Optimization**:
  - **Auto-Scrolling**: Automatically scrolls the page to trigger lazy-loaded images and content.
  - **Banner Dismissal**: Attempts to automatically dismiss common cookie consent banners and overlays.
  - **CSS Injection**: Support for custom CSS injection to modify the page before capture.
- **Robust Error Handling**: Maps complex Playwright/Network errors to human-readable messages.

## 🏗️ Architecture

The worker follows a clean, decoupled architecture:

- **Core Engine (`src/core/Worker.ts`)**: Orchestrates the job lifecycle. It is agnostic of the underlying queue, storage, or metadata providers.
- **Capture Service (`src/adapters/PlaywrightAdapter.ts`)**: The browser-based implementation of the rendering logic.
- **Provider Interfaces (`src/core/interfaces.ts`)**: Defines the contracts for external dependencies.
- **Adapters**:
  - **Local (`local/`)**: File-based implementations for offline development.
  - **Dev (`dev/`)**: WebSocket-based implementations for cloud-ready development.
  - **Cloud (Future)**: Managed service implementations (Service Bus, Blob Storage).

## 📂 Directory Structure

| Path | Description |
| :--- | :--- |
| `src/` | Core business logic and shared adapters. |
| `local/` | Local MVP environment (Phase 1.1). |
| `dev/` | Development/Cloud-Ready environment (Phase 1.2). |
| `docker/` | Dockerfiles for containerized execution. |
| `scripts/` | Seeding and utility scripts. |
| `tests/` | Comprehensive test suite (Local, Dev, Shared). |

## 🛠️ Key Scripts

Run these from the service root (`services/capture-worker/`):

| Command | Description |
| :--- | :--- |
| `npm run build` | Compiles the production core (`src/`). |
| `npm run dev` | Starts the **Local Worker** (interactive CLI). |
| `npm run dev:worker` | Starts the **Dev Worker** (WebSocket server). |
| `npm run dev:cli` | Starts the **Dev CLI** (WebSocket client). |
| `npm run test:local` | Runs tests for the Local environment. |
| `npm run test:dev` | Runs tests for the Dev environment. |

## 🔌 Environment Workflows

### 1. Local Development (Offline)
Used for rapid iteration on the browser engine without needing a network or cloud infrastructure.
- **Data**: Stored in `local/storage/`.
- **Guide**: [local/README.md](./local/README.md)

### 2. Dev Environment (Cloud-Ready)
Used to verify the worker in a distributed setup (e.g., inside Docker or Azure Container Apps).
- **Communication**: real-time via WebSockets.
- **Guide**: [dev/README.md](./dev/README.md)

## 🐳 Docker Deployment

To build and run the worker in a container:

```bash
# From project root
docker build -t capture-worker:dev -f services/capture-worker/docker/dev/Dockerfile .
docker run -p 3005:3005 capture-worker:dev
```

See [infrastructure/environments/dev/README.md](../../infrastructure/environments/dev/README.md) for ACR push instructions.
