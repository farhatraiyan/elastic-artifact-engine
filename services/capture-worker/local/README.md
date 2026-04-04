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
2.  **Build Prerequisites**: Build the shared types first.
    ```bash
    npm run build --workspace @render-engine/shared-types
    ```
3.  **Build Local Worker**: Build for development, type-checking, and local testing.
    ```bash
    npm run build:local
    ```
    *Note: `npm run build` compiles only the production core (`src/`) and is not used for local development.*

## Running the Worker

To start the worker in development mode (using `tsx`):

```bash
cd services/capture-worker
npm run dev
```

The worker will start an interactive CLI.

## Interactive CLI

The local worker now provides a CLI for interaction:

- `add <url> [type]`: Enqueue a new capture job (e.g., `add https://google.com png`).
- `list`: View the current queue.
- `clear`: Clear all jobs from the queue.
- `help`: Show available commands.
- `exit`: Stop the worker and exit.

## Seeding Jobs

If you want to quickly populate the queue with sample data without using the interactive CLI, you can use the seeding script from the service root:

```bash
# Seed default samples (Google, GitHub, Wikipedia)
npm run seed:local

# Or seed a custom URL
npm run seed:local -- https://bing.com png
```

## View Results

- Captured files are saved to `services/capture-worker/local/storage/output/`.
- The queue state is persisted in `services/capture-worker/local/storage/queue.json`.
- Status updates are displayed directly in the CLI.

## Parallel Processing

The worker is configured by default to process **2 jobs in parallel**. You can adjust this in `services/capture-worker/local/index.ts`.

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
| `type` | "pdf" \| "png" \| "md" | The output format. |
| `options.injectCss` | string | (Optional) Custom CSS to inject into the page. |
| `options.waitForTimeout` | number | (Optional) Milliseconds to wait after page load. |
