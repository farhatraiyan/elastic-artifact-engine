# Azure Adapters Package

This package provides a standardized, adapter-based interface for interacting with Azure Storage services (Blobs, Queues, and Tables). It is designed to be shared across multiple services in the Capture Automation Platform to ensure consistent infrastructure logic and simplified configuration.

## 🏗️ Design Philosophy

- **Interface-Driven**: All adapters implement shared interfaces, allowing for easy mocking in tests or swapping with alternative implementations.
- **Resilient**: Includes built-in support for adaptive backoff and retry policies (via Azure SDK defaults and custom wrappers).
- **Environment-Aware**: Automatically handles "Trusted Development" contexts (e.g., Azurite) when using the `UseDevelopmentStorage=true` shortcut.

## 📂 Core Adapters

- **`AzureBlobStorageAdapter`**: Handles persistence of captured artifacts (PDF, PNG, Markdown) to Azure Blob Storage.
- **`AzureQueueAdapter`**: Manages job message lifecycle (receive, complete, abandon) using Azure Queue Storage.
- **`AzureTableMetadataAdapter`**: Tracks job status and metadata in Azure Table Storage.

## 🛠️ Usage

### Installation
As a workspace dependency, it is automatically linked by NPM:
```json
"dependencies": {
  "@capture-automation-platform/azure-adapters": "*"
}
```

### Consumption
Import the adapters and their corresponding interfaces:

```typescript
import { 
  AzureBlobStorageAdapter, 
  StorageService 
} from "@capture-automation-platform/azure-adapters";

const storage: StorageService = new AzureBlobStorageAdapter(connectionString, containerName);
await storage.save("result.pdf", buffer);
```

## 🚀 Building & Testing

### Building
```bash
npm run build --workspace @capture-automation-platform/azure-adapters
```

### Testing
This package includes unit tests that run against **Azurite**. Running the test command will use `Procfile.test` integration to automatically spin up and tear down Azurite containers:

```bash
# Run tests (handles Azurite automatically)
npm test
```
