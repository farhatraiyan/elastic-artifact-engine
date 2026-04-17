# Development Infrastructure: Azure Container Registry (ACR)

This directory contains the Bicep templates and instructions for managing the Azure Container Registry used for `browser-orchestrator`.

## 1. Prerequisites

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed and authenticated (`az login`).
- [Docker Desktop](https://www.docker.com/products/docker-desktop) or Docker Engine installed and running.
- Active Azure Subscription.

## 2. Provision Infrastructure

To deploy the ACR using the provided Bicep template:

```bash
# Create a resource group (if not already created)
az group create --name rg-capture-automation-platform-dev --location eastus

# Deploy the ACR
az deployment group create \
  --resource-group rg-capture-automation-platform-dev \
  --template-file infrastructure/acr.bicep \
  --parameters acrSku=Basic
```

## 3. Registry Authentication

Authenticate your local Docker client to the ACR:

```bash
# Get the ACR login server (e.g., acr[unique].azurecr.io)
export ACR_NAME=$(az acr list --resource-group rg-capture-automation-platform-dev --query "[0].name" -o tsv)
az acr login --name $ACR_NAME
```

## 4. Build and Push the Docker Image

The Docker configuration has been centralized at the project root. Build and push the image using the provided scripts:

```bash
# Build the Docker image locally
npm run build:docker

# Tag the image for your ACR
docker tag browser-orchestrator $ACR_NAME.azurecr.io/browser-orchestrator:latest

# Push the image
docker push $ACR_NAME.azurecr.io/browser-orchestrator:latest
```

## Optimization Notes

- **Multi-stage Build**: Uses a builder stage to compile TypeScript and install dependencies, ensuring the final image only contains production-ready artifacts and required system libraries.
- **Dependency Pruning**: Specifically removes heavy devDependencies (`typescript`, `eslint`, etc.) from the final image layer to keep the footprint small for rapid deployment.
- **Playwright Dependencies**: Pre-installs the minimal Linux dependencies required for Chromium execution, avoiding runtime download overhead.
