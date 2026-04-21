# Deployment Infrastructure

Bicep modules and deployment commands for the Elastic Artifact Engine.

## Prerequisites

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) authenticated (`az login`).
- Docker.
- Resource Providers registered: `Microsoft.Storage`, `Microsoft.Web`, `Microsoft.App`, `Microsoft.ContainerRegistry`, `Microsoft.ManagedIdentity`.
- Target region supports Flex Consumption (e.g. `eastus`).

## Setup

Everything is scoped to a single resource group:

```bash
RG="rg-elastic-artifact-engine-dev"
LOCATION="eastus"

az group create --name $RG --location $LOCATION
```

## Modules (Deploy in Order)

> **Note:** AAD role propagation takes a few seconds. If a downstream deploy fails with `AuthorizationFailed` or a 403, retry the command.

### 1. Identity (`identity.bicep`)

Provisions the engine's User-Assigned Managed Identity (UAMI).

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

# --platform linux/amd64 required: buildx on Apple Silicon defaults to arm64,
# which pulls cleanly but fails to exec on ACA (x86-64) with a generic
# "container failed to start" in the logs.
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

> **API version pin:** `Microsoft.App/containerApps@2026-01-01` is required for `identity` on the KEDA `CustomScaleRule`. Older versions fail with `BCP037: property 'identity' is not allowed`.

## Application Deployment

### Ingress API

The Function App requires a pre-compiled `.zip` payload because remote Oryx builds cannot resolve local workspace packages (`@elastic-artifact-engine/*`).

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

> **Note:** `az functionapp deployment source config-zip` returns 202 but hits the legacy Kudu `/api/zipdeploy` endpoint, where the zip never surfaces as `released-package.zip` and functions fail to register. `az functionapp deploy --type zip` returns 415 on `az` CLI ≤ 2.85 (known Content-Type bug). Flex Consumption's actual deploy API is Kudu OneDeploy (`/api/publish`); the `curl` above hits it directly.

### Worker Updates

Re-tagging `:latest` in ACR does not trigger a Container App update — ACA resolves the image at revision-creation time, not on digest change, so an update without a new revision is a no-op. Force a new revision via `--revision-suffix`:

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

End-to-end smoketest (health → render → poll → download):

```bash
FUNC_NAME=$(az functionapp list --resource-group $RG --query "[0].name" -o tsv)
FUNC_KEY=$(az functionapp keys list --name $FUNC_NAME --resource-group $RG --query "functionKeys.default" -o tsv)

curl -s -o /dev/null -w "health HTTP %{http_code}\n" "https://${FUNC_NAME}.azurewebsites.net/api/health"

JOB_ID=$(curl -s -X POST "https://${FUNC_NAME}.azurewebsites.net/api/render?code=${FUNC_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf"}' | jq -r .jobId)

# First run pays KEDA poll (30s) + replica cold-start; expect ~30-60s.
STATUS_URL="https://${FUNC_NAME}.azurewebsites.net/api/status/${JOB_ID}?code=${FUNC_KEY}"
while :; do
  STATE=$(curl -s "$STATUS_URL")
  case "$STATE" in
    *'"status":"Completed"'*) echo "job Completed"; break ;;
    *'"status":"Failed"'*)    echo "job Failed: $STATE"; exit 1 ;;
    *) sleep 5 ;;
  esac
done

curl -s -L "https://${FUNC_NAME}.azurewebsites.net/api/download/${JOB_ID}?code=${FUNC_KEY}" \
  -o /tmp/${JOB_ID}.pdf -w "download HTTP %{http_code}, size=%{size_download}\n"
file /tmp/${JOB_ID}.pdf
```

Expected: `health HTTP 200`, `download HTTP 200, size=14733`, `PDF document, version 1.4, 1 pages`. The render of `https://example.com` is deterministic; a meaningfully different byte count means the render path changed.

### Troubleshooting `/api/health` 404

A 404 means the Function host is running but no triggers were registered (zip didn't land or the host couldn't load it). Check in order:

```bash
STORAGE_NAME=$(az storage account list --resource-group $RG --query "[0].name" -o tsv)
SUB_ID=$(az account show --query id -o tsv)
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)

# 1. Did the zip land in the deployment container?
# Requires Storage Blob Data Reader on your user
az storage blob list --account-name $STORAGE_NAME --container-name deployment \
  --auth-mode login --query "[].name" -o tsv

# 2. What functions did the host actually register?
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://management.azure.com/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Web/sites/${FUNC_NAME}/functions?api-version=2023-12-01" \
  | jq '.value[].name'
```

- No `released-package.zip` in (1) → publish never uploaded. Re-run stage + Kudu POST.
- Zip present but (2) returns empty → host couldn't load the bundle. Inspect `kudu-state.json` in the same container; a common cause is `npm ERR! 404` when a workspace dep escapes the bundler.
- Functions listed in (2) but `/api/health` still 404s → routing issue; `GET /admin/host/status` (master key required) surfaces runtime state.

## Teardown

```bash
az group delete --name $RG --yes --no-wait
```

