# Deployment Infrastructure

Bicep modules and deployment commands for the Capture Automation Platform.

## Prerequisites

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) authenticated (`az login`).
- Docker.
- Resource Providers registered: `Microsoft.Storage`, `Microsoft.Web`, `Microsoft.App`, `Microsoft.ContainerRegistry`, `Microsoft.ManagedIdentity`.
- Target region supports Flex Consumption (e.g. `eastus`).

## Setup

Everything is scoped to a single resource group:

```bash
RG="rg-capture-automation-platform-dev"
LOCATION="eastus"

az group create --name $RG --location $LOCATION
```

## Modules (Deploy in Order)

> **Note:** AAD role propagation takes a few seconds. If a downstream deploy fails with `AuthorizationFailed` or a 403, retry the command.

### 1. Identity (`identity.bicep`)

Provisions the platform's User-Assigned Managed Identity (UAMI).

```bash
az deployment group create \
  --resource-group $RG \
  --template-file infrastructure/identity.bicep
```

### 2. Storage (`storage.bicep`)

Provisions Storage Account and grants Blob/Queue/Table roles to the UAMI.

```bash
PRINCIPAL_ID=$(az identity list --resource-group $RG --query "[0].principalId" -o tsv)

az deployment group create \
  --resource-group $RG \
  --template-file infrastructure/storage.bicep \
  --parameters principalId=$PRINCIPAL_ID
```

### 3. Registry (`registry.bicep`)

Provisions ACR and grants `AcrPull` to the UAMI.

```bash
PRINCIPAL_ID=$(az identity list --resource-group $RG --query "[0].principalId" -o tsv)

az deployment group create \
  --resource-group $RG \
  --template-file infrastructure/registry.bicep \
  --parameters principalId=$PRINCIPAL_ID
```

**Push Initial Image:**
Push the image before deploying Container Apps so the initial revision can start cleanly.

```bash
ACR_NAME=$(az acr list --resource-group $RG --query "[0].name" -o tsv)
az acr login --name $ACR_NAME

docker buildx build \
  --platform linux/amd64 \
  -t $ACR_NAME.azurecr.io/browser-orchestrator:latest \
  -f docker/browser-orchestrator/Dockerfile \
  --push .
```

### 4. Functions (`functions.bicep`)

Provisions the Flex Consumption plan and Function App shell.

```bash
IDENTITY_ID=$(az identity list --resource-group $RG --query "[0].id" -o tsv)
IDENTITY_CLIENT_ID=$(az identity list --resource-group $RG --query "[0].clientId" -o tsv)
STORAGE_NAME=$(az storage account list --resource-group $RG --query "[0].name" -o tsv)

az deployment group create \
  --resource-group $RG \
  --template-file infrastructure/functions.bicep \
  --parameters \
    identityId=$IDENTITY_ID \
    identityClientId=$IDENTITY_CLIENT_ID \
    storageAccountName=$STORAGE_NAME
```

### 5. Container App (`containerapp.bicep`)

Provisions Managed Environment and worker app with KEDA queue-scaling.

```bash
IDENTITY_ID=$(az identity list --resource-group $RG --query "[0].id" -o tsv)
IDENTITY_CLIENT_ID=$(az identity list --resource-group $RG --query "[0].clientId" -o tsv)
STORAGE_NAME=$(az storage account list --resource-group $RG --query "[0].name" -o tsv)
ACR_LOGIN_SERVER=$(az acr list --resource-group $RG --query "[0].loginServer" -o tsv)

az deployment group create \
  --resource-group $RG \
  --template-file infrastructure/containerapp.bicep \
  --parameters \
    identityId=$IDENTITY_ID \
    identityClientId=$IDENTITY_CLIENT_ID \
    storageAccountName=$STORAGE_NAME \
    acrLoginServer=$ACR_LOGIN_SERVER
```

## Application Deployment

### Ingress API

The Function App requires a pre-compiled `.zip` payload because remote Oryx builds cannot resolve local workspace packages (`@capture-automation-platform/*`).

```bash
# 1. Stage the deployment bundle
ZIP=$(npm run stage:ingress-api --silent)

# 2. Publish to Kudu OneDeploy
FUNC_NAME=$(az functionapp list --resource-group $RG --query "[0].name" -o tsv)
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)

curl -fsSL -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary "@$ZIP" \
  "https://$FUNC_NAME.scm.azurewebsites.net/api/publish?type=zip&RemoteBuild=false"
```

### Worker Updates

Re-tagging `:latest` in ACR does not trigger a Container App update. Force a new revision:

```bash
CA_NAME=$(az containerapp list --resource-group $RG --query "[0].name" -o tsv)
ACR_LOGIN_SERVER=$(az acr list --resource-group $RG --query "[0].loginServer" -o tsv)

az containerapp update \
  --name $CA_NAME \
  --resource-group $RG \
  --image $ACR_LOGIN_SERVER/browser-orchestrator:latest \
  --revision-suffix "update$(date +%s)"
```

### Post-deploy Verification

Ensure the API is responsive (expect HTTP 200):

```bash
FUNC_NAME=$(az functionapp list --resource-group $RG --query "[0].name" -o tsv)
curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://${FUNC_NAME}.azurewebsites.net/api/health"
```

## Teardown

```bash
az group delete --name $RG --yes --no-wait
```
