#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
INGRESS_DIR="$REPO_ROOT/services/ingress-api"
STAGE="$INGRESS_DIR/.stage"
ZIP="$INGRESS_DIR/.stage.zip"

echo "Building ingress-api..." >&2
(cd "$REPO_ROOT" && npm run build --workspace @capture-automation-platform/ingress-api) >&2

rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE/dist"

echo "Bundling ingress-api into $STAGE/dist/index.js" >&2
(cd "$INGRESS_DIR" && npm run bundle -- --outfile="$STAGE/dist/index.js") >&2

echo "Staging host.json and stripped package.json" >&2
cp "$INGRESS_DIR/host.json" "$STAGE/"
cp "$INGRESS_DIR/package.json" "$STAGE/"
(cd "$STAGE" && npm pkg delete devDependencies scripts) >&2

echo "Installing production deps in staging..." >&2
(cd "$STAGE" && npm install --no-audit --no-fund) >&2

echo "Packaging $ZIP" >&2
(cd "$STAGE" && zip -rq "$ZIP" .) >&2

echo "$ZIP"
