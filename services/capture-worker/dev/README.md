# Dev Capture Worker (Phase 1.2)

This directory contains the development execution adapters for the Capture Worker. It provides a **"No-Plumbing" Cloud-Ready** environment using WebSockets to bridge the worker engine to an external CLI tool. This setup is designed to be deployed to **Azure Container Apps (ACA)** to verify the browser engine in the cloud before managed services (Queues/Storage/Cosmos) are provisioned.

## Prerequisites

- **Node.js**: v20 or higher.
- **Playwright Browsers**: You must install the Playwright browser binaries.
  ```bash
  npx playwright install chromium
  ```

## Setup & Installation

1.  **Install Dependencies**: Run from the project root.
    ```bash
    npm install
    ```
2.  **Build Prerequisites**: Build the shared types first.
    ```bash
    npm run build --workspace @render-engine/shared-types
    ```
3.  **Build Dev Worker**: Build for development, type-checking, and local testing.
    ```bash
    npm run build:dev
    ```

## Running the Dev Environment

Unlike the Local MVP, the Dev MVP splits the **Worker** (Server) and the **CLI** (Client) into two processes.

### 1. Start the Dev Worker
Starts the WebSocket server (default port 3005) and the rendering engine.
```bash
cd services/capture-worker
npm run dev:worker
```

### 2. Run the Dev CLI
A standalone, interactive tool to interact with the Worker via WebSockets.
```bash
cd services/capture-worker
npm run dev:cli [ws-url]
```
*Note: `ws-url` defaults to `ws://localhost:3005`.*

## Interactive CLI Commands

Once connected, the Dev CLI supports:

- `add <url> [type]`: Submit a new capture job (type: `pdf` | `screenshot`).
- `help`: Show available commands.
- `exit`: Disconnect and exit.

Status updates and binary results are streamed back to the CLI in real-time.

## How it Works

- **Queue**: Replaced by `WebSocketQueueAdapter` which buffers incoming jobs from the CLI.
- **Metadata**: Replaced by `WebSocketMetadataAdapter` which broadcasts status updates to the CLI.
- **Storage**: Replaced by `WebSocketStorageAdapter` which streams the binary `Buffer` directly to the CLI.
- **CLI Output**: The Dev CLI receives the binary data and saves it to `services/capture-worker/scripts/dev/output/`.

## Deployment (Azure Container Apps)

This code is designed to run inside an ACA container. 
- **Ingress**: ACA provides an HTTPS endpoint that terminates at the container's internal port.
- **Connectivity**: Connect the local Dev CLI to the ACA public URL (using `wss://`) to trigger remote captures.

## Testing

To run the Dev test suite (includes core engine tests and WebSocket infrastructure tests):

```bash
cd services/capture-worker
npm run test:dev
```
*Note: `dist-dev` is automatically cleaned up after the test run.*

## Supported Job Options

| Option | Type | Description |
| :--- | :--- | :--- |
| `url` | string | The full URL to capture. |
| `type` | "pdf" \| "screenshot" | The output format. |
| `options.injectCss` | string | (Optional) Custom CSS to inject into the page. |
| `options.waitForTimeout` | number | (Optional) Milliseconds to wait after page load. |
