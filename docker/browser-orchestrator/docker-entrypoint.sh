#!/bin/bash
set -e

# Start the Browser Orchestrator
echo "🏗️ Starting Browser Orchestrator..."
# Use 'exec' so the worker process receives signals directly from Docker
exec node services/browser-orchestrator/dist/index.js
