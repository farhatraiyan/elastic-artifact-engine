# Local Capture Worker (Phase 1.1)

This directory contains the local execution adapters for the Capture Worker. It allows you to run the rendering engine on your local machine using a file-based queue and local filesystem storage before moving to Azure.

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
2.  **Build Shared Types**: The worker depends on the shared types package.
    ```bash
    npm run build --workspace @render-engine/shared-types
    ```

## Running the Worker

To start the worker in development mode (using `tsx`):

```bash
cd services/capture-worker
npm run dev
```

The worker will start listening for jobs in `services/capture-worker/local-queue.json`.

## How to Capture a Webpage

The local worker uses a JSON file as a mock queue. To trigger a capture:

1.  **Create/Edit `local-queue.json`** in `services/capture-worker/`:
    ```json
    [
      {
        "id": "msg-001",
        "body": {
          "id": "job-abc",
          "url": "https://www.google.com",
          "type": "pdf",
          "options": {
            "width": 1280,
            "height": 800
          },
          "retryCount": 0
        }
      }
    ]
    ```

2.  **Save the file**: The worker polls this file every 2 seconds. It will pick up the job, process it, and remove the entry from the JSON array.

3.  **View Results**:
    -   Captured files are saved to `services/capture-worker/output/`.
    -   Status updates are logged to the console.

## Testing

To run the local test suite (including real Playwright renders):

```bash
cd services/capture-worker
npm run test:local
```

## Supported Job Options

| Option | Type | Description |
| :--- | :--- | :--- |
| `url` | string | The full URL to capture. |
| `type` | "pdf" \| "screenshot" | The output format. |
| `options.injectCss` | string | (Optional) Custom CSS to inject into the page. |
| `options.waitForTimeout` | number | (Optional) Milliseconds to wait after page load. |
