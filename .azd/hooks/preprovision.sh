#!/bin/bash
# Pre-provision hook — validate prerequisites

echo "Validating prerequisites..."

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo "ERROR: Azure CLI (az) is not installed."
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed."
    exit 1
fi

echo "All prerequisites met."
