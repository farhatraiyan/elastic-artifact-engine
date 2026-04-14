#!/bin/bash
set -e

# Start the Browser Orchestrator
echo "🏗️ Starting Browser Orchestrator..."
# Use 'exec' so the worker process receives signals directly from Docker
exec npm start --workspace @capture-automation-platform/browser-orchestrator
