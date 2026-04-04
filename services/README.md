# Render Engine Services

This directory contains the core services and shared packages that power the platform.

## 📂 Services & Packages

| Path | Name | Description |
| :--- | :--- | :--- |
| **[`capture-worker/`](./capture-worker)** | `@render-engine/capture-worker` | The rendering engine (Playwright). |
| **[`packages/shared-types/`](./packages/shared-types)** | `@render-engine/shared-types` | Centralized Zod-backed schemas and types. |

## 🏗️ Architecture Note

The project is structured as a **monorepo** using [NPM Workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces). This allows for:

1.  **Shared Types**: The `capture-worker` and future `frontend` can use the exact same Zod schemas for validation and type-safety.
2.  **Atomic Changes**: Changes that affect both a service and a shared package can be made in a single PR.
3.  **Scoped Commands**: You can run scripts for a specific service from the root using `--workspace`:
    ```bash
    npm run build --workspace @render-engine/capture-worker
    ```

## 🛠️ Development

For instructions on a specific service, refer to its local README.
