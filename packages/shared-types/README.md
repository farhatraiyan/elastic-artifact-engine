# Shared Types Package

This package serves as the **single source of truth** for all types and validation schemas used across the Capture Automation Platform project.

## 🏗️ Design Philosophy

- **Zod-First**: All core data structures are defined using [Zod](https://zod.dev/). This ensures that validation and TypeScript types are always in sync.
- **Service Independence**: This package has zero internal dependencies and is designed to be easily consumed by any service in the monorepo.

## 📂 Core Concepts

- **`CaptureJob`**: Defines the data required to perform a web capture (URL, options, type).
- **`JobStatus`**: Enum-like schema for tracking the lifecycle of a job (`Queued`, `Processing`, `Completed`, `Failed`).
- **`JobResult`**: The structure of a completed capture result.

## 🛠️ Usage

### Installation
As a workspace dependency, it is automatically linked by NPM:
```json
"dependencies": {
  "@capture-automation-platform/shared-types": "*"
}
```

### Consumption
Always import schemas and types from the package root:

```typescript
import { CaptureJob, CaptureJobSchema } from "@capture-automation-platform/shared-types";

// Validate incoming data
const job = CaptureJobSchema.parse(rawData);

// Use the inferred type
function processJob(job: CaptureJob) { ... }
```

## 🚀 Building & Contributing

When you modify schemas in `src/index.ts`, you **must** rebuild the package so the changes are available to other services:

```bash
# From project root
npm run build --workspace @capture-automation-platform/shared-types
```

### Quality Control
- **Linting**: `npm run lint`
- **Cleaning**: `npm run clean`
