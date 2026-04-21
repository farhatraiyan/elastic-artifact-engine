# Shared Types

Single source of truth for all types and validation schemas used across the Capture Automation Platform.

## 🏗️ Design

- **Zod-First**: Validation and TypeScript types are generated from a single Zod schema.
- **Service Independence**: Zero internal dependencies.

## 📂 Core Concepts

- **`CaptureJob`**: The data required to perform a web capture (URL, options, type).
- **`JobStatus`**: State machine enum (`Queued`, `Processing`, `Completed`, `Failed`).
- **`JobState`**: Tracking metadata including status, output URL, and errors.
- **`QueueMessage`**: Wrapper for Azure Storage Queue payloads.

## 🛠️ Usage

```typescript
import { CaptureJob, CaptureJobSchema } from "@capture-automation-platform/shared-types";

// Parse and validate incoming data
const job = CaptureJobSchema.parse(rawData);
```

## 🚀 Commands

_Execute from workspace root: `npm run <script> --workspace @capture-automation-platform/shared-types`_

| Command | Description |
| :--- | :--- |
| `npm run build` | Compiles Zod schemas to TS types for other packages to consume. |
| `npm run lint` | Lints source code. |
| `npm run clean` | Removes `dist/` and build artifacts. |