# Deployment Infrastructure

Bicep modules and deployment commands for the Capture Automation Platform on Azure.

## Prerequisites

- **[Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)** installed and authenticated (`az login`).
- **[Docker Desktop](https://www.docker.com/products/docker-desktop) or Docker Engine** installed and running. The image build step will fail with a cryptic `Cannot connect to the Docker daemon at unix:///...` if Docker isn't up.
- **Active Azure subscription** with the following resource providers registered. Most pre-existing subscriptions already have these; a brand-new subscription does not and will fail with `SubscriptionNotRegistered` errors:
  ```bash
  for ns in Microsoft.Storage Microsoft.Web Microsoft.App Microsoft.ContainerRegistry Microsoft.ManagedIdentity; do
    az provider register --namespace $ns
  done
  # Each registration is async; verify completion:
  az provider list --query "[?registrationState=='Registered'].namespace" -o tsv | grep -E '^Microsoft\.(Storage|Web|App|ContainerRegistry|ManagedIdentity)$'
  ```
  Note: `Microsoft.Web` occasionally lingers in `Registering` for 5+ minutes on newly-created or lightly-used subscriptions. If it hasn't flipped to `Registered` after a couple of minutes, force it through with the blocking form:
  ```bash
  az provider register --namespace Microsoft.Web --wait
  ```
- **A region that supports Flex Consumption** for the target RG location. Flex is not GA everywhere. As of 2026-04, common supported regions include `eastus`, `eastus2`, `westus2`, `westus3`, `northeurope`, `westeurope`, `southeastasia`. Check current availability:
  ```bash
  az functionapp list-flexconsumption-locations --query "[].name" -o tsv
  ```
  The commands below use `eastus`; change the RG location if you pick a different region.

## Resource group

Everything is scoped to a single resource group. Create the RG:

```bash
az group create --name rg-capture-automation-platform-dev --location eastus
```

All subsequent `az deployment group create` commands target this RG.

## Modules

Each section covers one Bicep module: what it provisions, how to deploy it, and how to verify the result. Modules are listed in deployment order, to be deployed top-to-bottom on a fresh RG.

> **Note on role-assignment propagation:** several modules create RBAC role assignments (Storage data-plane roles in `storage.bicep`, `AcrPull` in `registry.bicep`) that the next module then relies on. AAD role propagation usually completes in seconds but can occasionally take up to a few minutes. If a downstream deploy fails with `AuthorizationFailed`, `403 Forbidden` on an image pull, or similar role-dependent errors, wait 60-120 seconds and retry the same `az deployment group create` command. The Bicep modules are idempotent so re-running is safe.

### `identity.bicep`

Provisions a single User-Assigned Managed Identity (UAMI) that represents the platform. Every downstream module references this identity for data-plane access (Storage roles, ACR pull) and attaches it to compute (Functions, Container App) so the platform authenticates to Azure services.

**Template lineage:** derived from AVM [`avm/res/managed-identity/user-assigned-identity`](https://github.com/Azure/bicep-registry-modules/tree/main/avm/res/managed-identity/user-assigned-identity).

**Deploy:**

```bash
az deployment group create \
  --resource-group rg-capture-automation-platform-dev \
  --template-file infrastructure/identity.bicep
```

**Verify:**

```bash
az identity list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[].{name: name, principalId: principalId, clientId: clientId, location: location}" \
  -o json
```

Both `principalId` and `clientId` must be non-empty GUIDs. `principalId` is what downstream role assignments target, while `clientId` is what compute resources set as `AZURE_CLIENT_ID` in their app settings.

### `storage.bicep`

Provisions the Storage Account that backs the platform. Creates the blob container (`captures`), queue (`jobs`), and table (`metadata`) as child resources, and grants the UAMI three Storage data-plane roles (Blob Data Owner + Queue/Table Data Contributor) scoped to the account. The UAMI handles KEDA queue polling, ACR pull, Flex deployment-storage reads, and (post adapter migration) all app-level Blob/Queue/Table calls via `DefaultAzureCredential`.

Note: `allowSharedKeyAccess` is still `true` because the Functions runtime state store (`AzureWebJobsStorage` in `functions.bicep`) is the last consumer of shared-key auth. Tightening to `false` is gated on migrating that setting to the identity-based `AzureWebJobsStorage__accountName` / `__credential=managedidentity` triplet. The Bicep comment around that property calls out the remaining blocker.

**Template lineage:** storage-account shape and AAD-hardening from AVM [`avm/res/storage/storage-account`](https://github.com/Azure/bicep-registry-modules/tree/main/avm/res/storage/storage-account). Three-role assignment pattern from the [`function-app-flex-managed-identities`](https://github.com/Azure/azure-quickstart-templates/tree/master/quickstarts/microsoft.web/function-app-flex-managed-identities) quickstart.

**Deploy:**

```bash
# Fetch the UAMI's principalId from the already-deployed identity
PRINCIPAL_ID=$(az identity list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].principalId" -o tsv)

az deployment group create \
  --resource-group rg-capture-automation-platform-dev \
  --template-file infrastructure/storage.bicep \
  --parameters principalId=$PRINCIPAL_ID
```

**Verify** (all control-plane; works with your user AAD, no data-plane role needed):

```bash
STORAGE_NAME=$(az storage account list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].name" -o tsv)

STORAGE_ID=$(az storage account show \
  --name $STORAGE_NAME \
  --resource-group rg-capture-automation-platform-dev \
  --query id -o tsv)

# 1. Confirm AAD-only hardening landed
az storage account show \
  --name $STORAGE_NAME \
  --resource-group rg-capture-automation-platform-dev \
  --query "{allowSharedKeyAccess: allowSharedKeyAccess, minTls: minimumTlsVersion, bypass: networkRuleSet.bypass, defaultAction: networkRuleSet.defaultAction}" \
  -o json

# 2. Confirm the three role assignments exist on the UAMI at the storage scope
az role assignment list \
  --assignee $PRINCIPAL_ID \
  --scope $STORAGE_ID \
  --query "[].{role: roleDefinitionName, principalType: principalType}" \
  -o table
```

**Expected:** `allowSharedKeyAccess: true` (gated on `AzureWebJobsStorage` migration — see note above), `minTls: TLS1_2`, `bypass: AzureServices`, `defaultAction: Allow`; three role assignments (`Storage Blob Data Owner`, `Storage Queue Data Contributor`, `Storage Table Data Contributor`), all `principalType: ServicePrincipal`. Blob is Owner (not Contributor) because Flex Consumption's identity-based deployment storage requires Owner on the deployment account.

Child resources (`captures`/`jobs`/`metadata`) are not directly enumerable via `az resource list`. They're nested sub-subresources which only appear in the deployment's `outputResources` list. If you need to verify them independently, use `az deployment group show --name storage --resource-group <rg>`.

### `registry.bicep`

Provisions the Azure Container Registry for the `browser-orchestrator` image and grants the UAMI `AcrPull` scoped to the registry. Basic SKU to minimize idle cost. Admin user is disabled as all pulls go through the UAMI.

**Template lineage:** role-assignment pattern from AVM [`avm/res/container-registry/registry`](https://github.com/Azure/bicep-registry-modules/tree/main/avm/res/container-registry/registry).

**Deploy:**

```bash
PRINCIPAL_ID=$(az identity list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].principalId" -o tsv)

az deployment group create \
  --resource-group rg-capture-automation-platform-dev \
  --template-file infrastructure/registry.bicep \
  --parameters principalId=$PRINCIPAL_ID
```

Note: SKU defaults to `Basic` in the module; override with `--parameters acrSku=Premium` if you need private endpoints or geo-replication.

**Verify:**

```bash
ACR_NAME=$(az acr list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].name" -o tsv)
ACR_ID=$(az acr show \
  --name $ACR_NAME \
  --resource-group rg-capture-automation-platform-dev \
  --query id -o tsv)

# 1. Registry SKU + admin disabled
az acr show \
  --name $ACR_NAME \
  --resource-group rg-capture-automation-platform-dev \
  --query "{name: name, sku: sku.name, adminUserEnabled: adminUserEnabled, loginServer: loginServer}" \
  -o json

# 2. Confirm AcrPull role assignment to the UAMI
az role assignment list \
  --assignee $PRINCIPAL_ID \
  --scope $ACR_ID \
  --query "[].{role: roleDefinitionName, principalType: principalType}" \
  -o table
```

**Expected:** `sku: Basic`, `adminUserEnabled: false`, non-empty `loginServer`; one row showing `AcrPull` with `principalType: ServicePrincipal`.

**Authenticate Docker to the registry:**

```bash
az acr login --name $ACR_NAME
```

**Build and push the image:**

```bash
docker buildx build \
  --platform linux/amd64 \
  -t $ACR_NAME.azurecr.io/browser-orchestrator:latest \
  -f docker/browser-orchestrator/Dockerfile \
  --push \
  .
```

Note: The root-level `npm run build:docker` script is intentionally unpinned and reserved for local development.

Pushing the image before `containerapp.bicep` deploys (below) is deliberate: when ACA creates the first revision, the image is already available in ACR, so the revision comes up `Healthy` immediately. Deploying `containerapp.bicep` before the image exists leaves you with a failed first revision that won't auto-recover, forcing a manual revision re-cut (see the "Pushing a new image" section under Application Deployment).

### `functions.bicep`

Provisions the Flex Consumption Function App hosting the `ingress-api` service, alongside its Flex plan and a `deployment` blob container which holds the zip package that Flex pulls at cold start. The UAMI is attached and used for Flex's deployment-storage pull, so the Function App's identity can read the zip from the `deployment` container using its Blob Data Owner role. The app-level adapters now authenticate via `DefaultAzureCredential` — `AZURE_CLIENT_ID` + `AZURE_STORAGE_ACCOUNT_NAME` are emitted to the app settings and trigger the identity branch in service wiring. Only `AzureWebJobsStorage` (Functions runtime state) still uses a connection string.

Note: Migrating `AzureWebJobsStorage` to the identity-based `AzureWebJobsStorage__accountName` / `__credential=managedidentity` / `__clientId` triplet is the last step before `storage.bicep` can flip `allowSharedKeyAccess: false`.

**Template lineage:** Flex-Consumption `functionAppConfig.deployment.storage` with UserAssignedIdentity auth from Quickstart [`function-app-flex-managed-identities`](https://github.com/Azure/azure-quickstart-templates/tree/master/quickstarts/microsoft.web/function-app-flex-managed-identities).

Note: That same quickstart also documents the identity-based `AzureWebJobsStorage__accountName` / `__credential: 'managedidentity'` / `__clientId` triplet — the next step for fully removing shared-key auth from the storage account.

**Deploy:**

```bash
# Fetch identity + storage outputs from prior deployments
IDENTITY_ID=$(az identity list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].id" -o tsv)
IDENTITY_CLIENT_ID=$(az identity list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].clientId" -o tsv)
STORAGE_NAME=$(az storage account list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].name" -o tsv)

az deployment group create \
  --resource-group rg-capture-automation-platform-dev \
  --template-file infrastructure/functions.bicep \
  --parameters \
    identityId=$IDENTITY_ID \
    identityClientId=$IDENTITY_CLIENT_ID \
    storageAccountName=$STORAGE_NAME
```

**Verify:**

```bash
FUNC_NAME=$(az functionapp list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].name" -o tsv)

# 1. Function App kind + attached identity. `state` and `defaultHostName` live under `properties` in `az functionapp show` output.
az functionapp show \
  --name $FUNC_NAME \
  --resource-group rg-capture-automation-platform-dev \
  --query "{name: name, state: properties.state, kind: kind, hostname: properties.defaultHostName, identityType: identity.type, userAssignedIds: keys(identity.userAssignedIdentities)}" \
  -o json

# 2. Flex Consumption plan. list + show avoids having to dig through `functionapp show` output for the serverFarmId.
PLAN_NAME=$(az appservice plan list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].name" -o tsv)
az appservice plan show \
  --resource-group rg-capture-automation-platform-dev \
  --name $PLAN_NAME \
  --query "{name: name, sku: sku.name, tier: sku.tier, reserved: reserved}" \
  -o json

# 3. App settings. Both the Functions runtime (AzureWebJobsStorage) and the adapter-facing vars (AZURE_STORAGE_*) are listed.
az functionapp config appsettings list \
  --name $FUNC_NAME \
  --resource-group rg-capture-automation-platform-dev \
  --query "[?contains(name, 'WebJobsStorage') || starts_with(name, 'AZURE_')].{name: name, value: value}" \
  -o table
```

**Expected:**
- `state: Running`, `kind: functionapp,linux`, `identityType: UserAssigned`, one entry under `userAssignedIds`.
- Plan `sku: FC1`, `tier: FlexConsumption`. (`reserved` returns `null` as Flex Consumption is Linux-implicit and the provider doesn't surface the property the way classic Linux plans do.)
- App settings include `AzureWebJobsStorage` (connection string), `AZURE_CLIENT_ID`, `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_BLOB_CONTAINER_NAME`, `AZURE_STORAGE_QUEUE_NAME`, `AZURE_STORAGE_TABLE_NAME`. `AZURE_STORAGE_CONNECTION_STRING` is no longer set — the adapters use `DefaultAzureCredential` keyed off `AZURE_STORAGE_ACCOUNT_NAME`.

Note: The identity-based `AzureWebJobsStorage__accountName` / `__credential` / `__clientId` triplet is *not* present at this time.

### `containerapp.bicep`

Provisions the Container Apps Managed Environment and the `browser-orchestrator` Container App, which is the worker side of the async request-reply pipeline. The UAMI is attached and used for three things: pulling the image from ACR, authenticating the KEDA queue-length scaler against the `jobs` queue, and serving as the credential source for the worker's app-level adapters via `DefaultAzureCredential`. `AZURE_CLIENT_ID` + `AZURE_STORAGE_ACCOUNT_NAME` are set on the Container App; the adapters derive blob/queue/table URLs from the account name. Scales 0-5 replicas driven by queue depth (not applied to ingress) as the worker only consumes messages.

**Template lineage:** Managed Environment + Container App shape from AVM [`avm/res/app/managed-environment`](https://github.com/Azure/bicep-registry-modules/tree/main/avm/res/app/managed-environment) and [`avm/res/app/container-app`](https://github.com/Azure/bicep-registry-modules/tree/main/avm/res/app/container-app). The identity-based KEDA `azure-queue` scale rule is hand-written as no first-party Bicep sample assembles it end-to-end, only the ARM reference documents the shape. See [Learn: Scale app — Using managed identity](https://learn.microsoft.com/en-us/azure/container-apps/scale-app#using-managed-identity).

**API version pin matters.** `Microsoft.App/containerApps@2024-03-01` (GA at the time of writing the original deployment) does *not* expose `identity` on `CustomScaleRule`. `2026-01-01` (current GA) does. If you see `BCP037: property 'identity' is not allowed` or ARM's `ContainerAppInvalidSchema` at `$[0].custom`, bump the API version.

**Deploy:**

```bash
IDENTITY_ID=$(az identity list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].id" -o tsv)
IDENTITY_CLIENT_ID=$(az identity list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].clientId" -o tsv)
STORAGE_NAME=$(az storage account list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].name" -o tsv)
ACR_LOGIN_SERVER=$(az acr list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].loginServer" -o tsv)

az deployment group create \
  --resource-group rg-capture-automation-platform-dev \
  --template-file infrastructure/containerapp.bicep \
  --parameters \
    identityId=$IDENTITY_ID \
    identityClientId=$IDENTITY_CLIENT_ID \
    storageAccountName=$STORAGE_NAME \
    acrLoginServer=$ACR_LOGIN_SERVER
```

First deploy takes 1-2 minutes (Managed Environment provisioning). Idempotent re-runs complete in ~20s.

**Verify:**

```bash
CA_NAME=$(az containerapp list \
  --resource-group rg-capture-automation-platform-dev \
  --query "[0].name" -o tsv)

# 1. Container App shell + UAMI + registry identity pull + no ingress
az containerapp show \
  --name $CA_NAME \
  --resource-group rg-capture-automation-platform-dev \
  --query "{name: name, provisioningState: properties.provisioningState, runningStatus: properties.runningStatus, identityType: identity.type, userAssignedIds: keys(identity.userAssignedIdentities), image: properties.template.containers[0].image, ingress: properties.configuration.ingress, registries: properties.configuration.registries[0]}" \
  -o json

# 2. KEDA scale rule. Confirm identity-based azure-queue scaler.
# ARM normalizes `custom { type: 'azure-queue', identity }` to the first-class
# `azureQueue` rule shape with `identity` embedded. Functionally identical.
az containerapp show \
  --name $CA_NAME \
  --resource-group rg-capture-automation-platform-dev \
  --query "properties.template.scale" \
  -o json

# 3. Env vars
az containerapp show \
  --name $CA_NAME \
  --resource-group rg-capture-automation-platform-dev \
  --query "properties.template.containers[0].env[].{name: name, value: value}" \
  -o table
```

**Expected:**
- `provisioningState: Succeeded`, `runningStatus: Running`, `identityType: UserAssigned`, one entry in `userAssignedIds`.
- `registries[0]` has `identity: <uami-resource-id>`, `passwordSecretRef: ""`, `username: ""` (confirms identity-based ACR pull).
- `ingress: null` (worker has no HTTP surface).
- `scale.rules[0].azureQueue` includes `accountName`, `queueName`, `queueLength`, and `identity: <uami-resource-id>`.
- Env vars include `AZURE_CLIENT_ID`, `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_BLOB_CONTAINER_NAME`, `AZURE_STORAGE_QUEUE_NAME`, `AZURE_STORAGE_TABLE_NAME`, `CONCURRENCY`, `MAX_RETRIES`. `AZURE_STORAGE_CONNECTION_STRING` is no longer set — the adapters use `DefaultAzureCredential` keyed off `AZURE_STORAGE_ACCOUNT_NAME`.

## Application Deployment

By this point the Bicep modules have provisioned every resource shell and the `browser-orchestrator` image is already in ACR. The only remaining app-side step on first deploy is publishing the ingress-api code.

### Step 1 — Ingress API: publish code to the Function App

The Function App shell is live from `functions.bicep` but has no code. Remote build via Oryx **will fail** because Flex Consumption's `npm install` runs against the public npm registry, which 404s on the monorepo's workspace packages (`@capture-automation-platform/*`). Deploying requires staging a self-contained zip and pushing it directly to the Flex deploy endpoint.

**Stage:**

```bash
ZIP=$(npm run stage:ingress-api --silent)
```

What `scripts/stage-ingress-api.sh` does, in order:

1. Runs `npm run build --workspace @capture-automation-platform/ingress-api` so `tsc -b` walks ingress-api's project references (`tsconfig.json#references`) and builds every upstream workspace in order. Adding a new workspace dep means adding one line to that `references` array, not a line here.
2. Bundles `src/index.ts` into `.stage/dist/index.js` — a single ESM file that inlines workspace deps (`@capture-automation-platform/*`) and their transitives (e.g. `zod`). `@azure/*` packages are marked `--external` and stay as runtime imports: bundling them into ESM breaks at runtime with *"Dynamic require of 'net' is not supported"* because the Azure SDK's internal http client uses dynamic `require()` that esbuild's ESM output can't statically rewrite. Leaving them external sidesteps the issue entirely — Node resolves them from `node_modules` at runtime and their internal CJS `require()` works natively.
3. Copies `host.json` and `package.json` into `.stage/` and runs `npm pkg delete devDependencies scripts` to strip everything that isn't runtime (workspace deps live in `devDependencies` so this one operation removes them). Source's `type: module` + `main: dist/index.js` carry through unchanged — no module-format flip between source and deployed artifact.
4. `npm install` inside the stage — installs the `@azure/*` runtime deps declared in `services/ingress-api/package.json` (functions, storage-blob, storage-queue, data-tables). No workspace-scoped names are resolved, so no public-registry 404s.
5. Zips the stage into `services/ingress-api/.stage.zip`.

Both `.stage/` and `.stage.zip` are gitignored. Progress goes to stderr; the zip path is the sole line of stdout, so `ZIP=$(...)` captures it cleanly. Each run wipes and recreates both.

**Publish:**

The Flex Consumption deploy endpoint is Kudu OneDeploy (`POST /api/publish`). Call OneDeploy directly with an AAD token:

```bash
RG=rg-capture-automation-platform-dev
FUNC_NAME=$(az functionapp list --resource-group "$RG" --query "[0].name" -o tsv)

TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)

curl -fsSL -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary "@$ZIP" \
  "https://$FUNC_NAME.scm.azurewebsites.net/api/publish?type=zip&RemoteBuild=false"
```

Returns `202 Accepted` with a deployment id. Poll `GET /api/deployments/<id>` on the SCM site (same bearer token) until `"complete": true, "status": 4`. After that, the Flex host needs ~15–20s to pick up the new `released-package.zip` from deployment storage; the first `GET /api/health` will also pay a cold-start tax.

To target a different resource group or app, change `RG` / `FUNC_NAME` before the token/curl calls.

### Step 2 — Pushing a new image (subsequent deploys only)

Not needed on first deploy if you followed the ordering above as the first revision pulled the image at creation time. This step only applies on *subsequent* image pushes: re-tagging `:latest` in ACR does not trigger a new revision (Container Apps pulls at revision creation, not on digest change), so rerun this command after every image update.

```bash
CA_NAME=$(az containerapp list --resource-group rg-capture-automation-platform-dev --query "[0].name" -o tsv)
ACR_LOGIN_SERVER=$(az acr list --resource-group rg-capture-automation-platform-dev --query "[0].loginServer" -o tsv)

az containerapp update \
  --name $CA_NAME \
  --resource-group rg-capture-automation-platform-dev \
  --image $ACR_LOGIN_SERVER/browser-orchestrator:latest \
  --revision-suffix "update$(date +%s)"
```

The `--revision-suffix` forces ARM to create a new revision (otherwise the update is a no-op when the image reference string is unchanged). The new revision pulls `:latest` fresh.

Note: If you deployed `containerapp.bicep` *before* pushing the image (e.g. strict top-to-bottom Modules order), this step is required on first deploy too as the first revision will be stuck in a failed pull state until a new revision is cut.

### Post-deploy verification

Full end-to-end smoke test: exercises ingress, queue, worker scale-up, Playwright capture, blob write, SAS generation, and redirect download:

```bash
FUNC_NAME=$(az functionapp list --resource-group rg-capture-automation-platform-dev --query "[0].name" -o tsv)
FUNC_KEY=$(az functionapp keys list --name $FUNC_NAME --resource-group rg-capture-automation-platform-dev --query "functionKeys.default" -o tsv)

# 1. Anonymous health check (no key needed) — expect HTTP 200, body "OK"
curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://${FUNC_NAME}.azurewebsites.net/api/health"

# 2. Submit a capture — expect HTTP 202 and a jobId in the JSON response
RESP=$(curl -s -X POST "https://${FUNC_NAME}.azurewebsites.net/api/capture?code=${FUNC_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","type":"pdf"}')
echo "$RESP"
JOB_ID=$(echo "$RESP" | grep -oE '"jobId":"[^"]+"' | cut -d'"' -f4)

# 3. Poll until the worker finishes — expect Queued -> Completed within ~30-60s
#    (KEDA polls the queue every 30s; cold-start of a new ACA replica adds a few seconds)
while true; do
  JOB=$(curl -s "https://${FUNC_NAME}.azurewebsites.net/api/status/${JOB_ID}?code=${FUNC_KEY}")
  JOB_STATUS=$(echo "$JOB" | grep -oE '"status":"[^"]+"' | cut -d'"' -f4)
  echo "  status=$JOB_STATUS"
  [ "$JOB_STATUS" = "Completed" ] || [ "$JOB_STATUS" = "Failed" ] && break
  sleep 5
done

# 4. Follow the download redirect and save the PDF — expect 14,733 bytes
#    (static input page + deterministic Chromium rendering = byte-reproducible output;
#    if the size differs meaningfully, something changed in the capture path)
mkdir -p output
curl -s -L "https://${FUNC_NAME}.azurewebsites.net/api/download/${JOB_ID}?code=${FUNC_KEY}" \
  -o "output/${JOB_ID}.pdf" \
  -w "HTTP %{http_code}, size: %{size_download} bytes\n"

# 5. Validate the file is a real PDF
file "output/${JOB_ID}.pdf"
```

**Expected:**
- `/api/health` → HTTP 200, `OK`
- `/api/capture` → HTTP 202, `{"jobId":"<uuid>","status":"Queued"}`
- `/api/status/{jobId}` → transitions `Queued` → `Completed`, typically within 30-60 seconds on a cold ACA (KEDA 30s poll + replica warm-up)
- `/api/download/{jobId}` → HTTP 200 after redirect follow, exactly 14,733 bytes for `https://example.com` as a PDF
- `file` reports `PDF document, version 1.4, 1 pages`

### Troubleshooting a 404 on `/api/health`

A 404 on the anonymous health endpoint means the Function App is running but no triggers got registered, meaning the Functions host didn't see any code. Two things to check:

```bash
STORAGE_NAME=$(az storage account list --resource-group rg-capture-automation-platform-dev --query "[0].name" -o tsv)
FUNC_NAME=$(az functionapp list --resource-group rg-capture-automation-platform-dev --query "[0].name" -o tsv)
SUB_ID=$(az account show --query id -o tsv)

# 1. Did the zip actually land in the deployment container?
EXPIRY=$(date -u -v+1H +"%Y-%m-%dT%H:%MZ" 2>/dev/null || date -u -d "+1 hour" +"%Y-%m-%dT%H:%MZ")
SAS=$(az storage account generate-sas \
  --account-name $STORAGE_NAME \
  --services b --resource-types sco --permissions rl \
  --expiry "$EXPIRY" --https-only -o tsv)
curl -s "https://${STORAGE_NAME}.blob.core.windows.net/deployment?restype=container&comp=list&${SAS}" \
  | grep -oE '<Name>[^<]*</Name>'

# 2. Ask the management API what functions the host has actually registered.
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://management.azure.com/subscriptions/${SUB_ID}/resourceGroups/rg-capture-automation-platform-dev/providers/Microsoft.Web/sites/${FUNC_NAME}/functions?api-version=2023-12-01" \
  | python3 -m json.tool
```

Reading the output:

- If (1) shows no `released-package.zip`, the publish never uploaded. Rerun the stage + publish sequence and check each command's exit status.
- If (1) shows `released-package.zip` but (2) returns `"value": []`, the zip uploaded but the host couldn't load it. Inspect `kudu-state.json` in the same container for per-step errors, and look for `Kudu-OryxBuildStep` failures (typically `npm ERR! 404` if something escaped the bundler and hit the public registry) or a missing `node_modules/` (publish was run against an unstaged dir or the stage dir's `npm install` step was skipped).
- If (2) lists the four functions (`capture`, `download`, `health`, `status`) but `/api/health` still 404s, the host is serving but routing is wrong — try `curl https://${FUNC_NAME}.azurewebsites.net/admin/host/status` (needs master key) to confirm the runtime state.

## Teardown

Everything is RG-scoped, so a full reset is a single command:

```bash
az group delete --name rg-capture-automation-platform-dev --yes --no-wait
```

Role assignments, the UAMI, the registry, and all future resources are deleted with the RG. No subscription-level assignments to clean up.
