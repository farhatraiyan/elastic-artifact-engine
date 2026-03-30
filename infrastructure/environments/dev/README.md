# Development Infrastructure: Azure Container Registry (ACR)

This directory contains the Bicep templates and instructions for managing the Azure Container Registry used for development images, specifically the `capture-worker`.

## 1. Prerequisites

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed and authenticated (`az login`).
- [Docker Desktop](https://www.docker.com/products/docker-desktop) or Docker Engine installed and running.
- Active Azure Subscription.

## 2. Provision Infrastructure

To deploy the ACR using the provided Bicep template:

```bash
# Create a resource group (if not already created)
az group create --name rg-render-engine-dev --location eastus

# Deploy the ACR
az deployment group create \
  --resource-group rg-render-engine-dev \
  --template-file infrastructure/environments/dev/acr.bicep \
  --parameters acrSku=Basic
```

## 3. Registry Authentication

Authenticate your local Docker client to the ACR:

```bash
# Get the ACR login server (e.g., acr[unique].azurecr.io)
export ACR_NAME=$(az acr list --resource-group rg-render-engine-dev --query "[0].name" -o tsv)
az acr login --name $ACR_NAME
```

## 4. Build and Push Optimized Dev Image

The `capture-worker` dev image is optimized via a multi-stage Dockerfile to include necessary Playwright dependencies while minimizing final image size.

### Build the Image
From the **project root**:

```bash
docker build -t capture-worker:dev -f services/capture-worker/docker/dev/Dockerfile .
```

### Tag and Push to ACR
```bash
# Tag the image for ACR
export LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
docker tag capture-worker:dev $LOGIN_SERVER/capture-worker:dev

# Push to the registry
docker push $LOGIN_SERVER/capture-worker:dev
```

## 5. Verification

Verify the image exists in the registry:

```bash
az acr repository list --name $ACR_NAME --output table
az acr repository show-tags --name $ACR_NAME --repository capture-worker --output table
```

## Optimization Notes

- **Multi-stage Build**: Uses a builder stage to compile TypeScript and install dependencies, ensuring the final image only contains production-ready artifacts and required system libraries.
- **Dependency Pruning**: Specifically removes heavy devDependencies (`typescript`, `eslint`, etc.) from the final image layer to keep the footprint small for rapid deployment.
- **Playwright Dependencies**: Pre-installs the minimal Linux dependencies required for Chromium execution, avoiding runtime download overhead.
