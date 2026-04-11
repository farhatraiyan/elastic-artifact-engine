#!/bin/bash
set -e

# Start Azurite in the background
echo "🚀 Starting Azurite (Storage Emulator)..."
mkdir -p /app/data
azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0 --location /app/data --skipApiVersionCheck &
AZURITE_PID=$!

# Graceful cleanup on stop
cleanup() {
  echo "🛑 Stopping services..."
  kill $AZURITE_PID
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait briefly for Azurite to initialize
sleep 2

# Initialize resources (Queue, Blob, Table) if using local storage
if [[ "$AZURE_STORAGE_CONNECTION_STRING" == *"UseDevelopmentStorage=true"* ]]; then
  echo "🛠️  Initializing local storage resources..."
  node services/browser-orchestrator/dist-dev/setup-azurite.js
fi

# Start the Browser Orchestrator
echo "🏗️ Starting Browser Orchestrator..."
# Use 'exec' so the worker process receives signals directly from Docker
exec npm start --workspace @render-engine/browser-orchestrator
