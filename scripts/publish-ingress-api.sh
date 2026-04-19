#!/usr/bin/env bash
# Package the ingress-api Function App as a self-contained zip with workspace
# deps resolved to local file: refs, then publish to an Azure Function App
# with --no-build (skipping Flex's Oryx remote build).
#
# Why this exists: Oryx's `npm install` hits the public npm registry, which
# 404s on @capture-automation-platform/* packages (monorepo-local, not
# published). Bundling locally and pushing with --no-build sidesteps that.
# Long-term fix is esbuild bundling so the zip has zero workspace deps.
#
# Usage:
#   scripts/publish-ingress-api.sh [function-app-name]
#
# If function-app-name is omitted, the first Function App in $RG is used
# ($RG defaults to rg-capture-automation-platform-dev).

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
INGRESS_DIR="$REPO_ROOT/services/ingress-api"
RG="${RG:-rg-capture-automation-platform-dev}"
FUNC_NAME="${1:-}"

# Prereq checks
if ! command -v func >/dev/null 2>&1; then
  echo "Error: Azure Functions Core Tools (func) is not installed." >&2
  echo "Install with: npm install -g azure-functions-core-tools@4 --unsafe-perm true" >&2
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "Error: Azure CLI (az) is not installed." >&2
  exit 1
fi

# Auto-detect function app if not provided
if [ -z "$FUNC_NAME" ]; then
  echo "Looking up Function App in resource group $RG..."
  FUNC_NAME=$(az functionapp list --resource-group "$RG" --query "[0].name" -o tsv)
  if [ -z "$FUNC_NAME" ]; then
    echo "Error: no Function App found in resource group $RG" >&2
    exit 1
  fi
  echo "Found: $FUNC_NAME"
fi

# Ensure local.settings.json exists (func CLI reads FUNCTIONS_WORKER_RUNTIME
# from it to detect the project language; the file is gitignored because it
# would normally contain local secrets)
LOCAL_SETTINGS="$INGRESS_DIR/local.settings.json"
if [ ! -f "$LOCAL_SETTINGS" ]; then
  echo "Creating $LOCAL_SETTINGS (gitignored)..."
  cat > "$LOCAL_SETTINGS" <<'EOF'
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "AZURE_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "AZURE_STORAGE_BLOB_CONTAINER_NAME": "captures",
    "AZURE_STORAGE_QUEUE_NAME": "jobs",
    "AZURE_STORAGE_TABLE_NAME": "metadata"
  }
}
EOF
fi

# Ensure everything is built (workspace deps need their dist/ to be current)
echo "Building project..."
(cd "$REPO_ROOT" && npm run build)

# Stage a self-contained deployment directory
STAGE="/tmp/publish-ingress-api-$$"
rm -rf "$STAGE"
mkdir -p "$STAGE"
trap 'rm -rf "$STAGE"' EXIT

echo "Staging at $STAGE"

# Copy workspace packages and drop their node_modules (repopulated fresh below)
mkdir -p "$STAGE/_workspace_packages"
for pkg in shared-types azure-adapters; do
  cp -R "$REPO_ROOT/packages/$pkg" "$STAGE/_workspace_packages/$pkg"
  rm -rf "$STAGE/_workspace_packages/$pkg/node_modules"
done

# Rewrite azure-adapters' own workspace dep on shared-types to a relative file: ref
node -e "
const fs = require('fs');
const p = '$STAGE/_workspace_packages/azure-adapters/package.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
j.dependencies['@capture-automation-platform/shared-types'] = 'file:../shared-types';
fs.writeFileSync(p, JSON.stringify(j, null, 2));
"

# Copy ingress-api source (excluding node_modules, tests, build info)
(cd "$INGRESS_DIR" && tar \
  --exclude='node_modules' \
  --exclude='tests' \
  --exclude='*.tsbuildinfo' \
  -cf - .) | (cd "$STAGE" && tar -xf -)

# Rewrite ingress-api's workspace deps to file: refs
node -e "
const fs = require('fs');
const p = '$STAGE/package.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
j.dependencies['@capture-automation-platform/shared-types'] = 'file:./_workspace_packages/shared-types';
j.dependencies['@capture-automation-platform/azure-adapters'] = 'file:./_workspace_packages/azure-adapters';
fs.writeFileSync(p, JSON.stringify(j, null, 2));
"

# Install deps locally — resolves workspace deps from disk, not from npm
echo "Installing deps in staging..."
(cd "$STAGE" && npm install --legacy-peer-deps --install-links --no-audit --no-fund)

# Publish with --no-build — zip already contains node_modules, Oryx skips
echo "Publishing to Function App: $FUNC_NAME"
(cd "$STAGE" && func azure functionapp publish "$FUNC_NAME" --no-build)

echo ""
echo "Publish complete. Verify with:"
echo "  curl https://${FUNC_NAME}.azurewebsites.net/api/health"
