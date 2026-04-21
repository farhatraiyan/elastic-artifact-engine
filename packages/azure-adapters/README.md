# Azure Adapters

Standardized adapter interfaces for Azure Storage services (Blobs, Queues, Tables) shared across the Capture Automation Platform.

## 🏗️ Design

- **Interface-Driven**: Easily mockable or swappable implementations (`StorageService`, `QueueService`, `MetadataService`).
- **Resilient**: Built-in adaptive backoff and polling.
- **Identity Support**: Seamless `DefaultAzureCredential` integration via `fromCredential` factory methods.

## 📂 Adapters

- **`AzureBlobStorageAdapter`**: Artifact persistence (PDF, PNG, MD) and SAS URL generation.
- **`AzureQueueAdapter`**: Job lifecycle management (receive, complete, abandon) with max retry limits.
- **`AzureTableMetadataAdapter`**: Real-time job status tracking.

## 🛠️ Usage

```typescript
import { 
  AzureBlobStorageAdapter, 
  StorageService 
} from "@capture-automation-platform/azure-adapters";

const storage: StorageService = AzureBlobStorageAdapter.fromConnectionString(connectionString, containerName);
await storage.save("result.pdf", buffer);
```

## 🚀 Commands

_Execute from workspace root: `npm run <script> --workspace @capture-automation-platform/azure-adapters`_

| Command | Description |
| :--- | :--- |
| `npm run build` | Compiles source. |
| `npm run lint` | Lints source and tests. |
| `npm test` | Runs integration tests directly against source via `tsx`. Requires Azurite. |