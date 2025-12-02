#!/bin/bash
# Build ChromaDB English index against running ChromaDB server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CHROMA_SERVER_URL="${CHROMA_SERVER_URL:-http://chromadb-server:8000}"
CONTAINER_NAME="${CONTAINER_NAME:-chaatra-chromadb-server}"

echo "Building ChromaDB Dictionary English index..."
echo ""

# Check if ChromaDB server container is running (skip if docker command not available - running in container)
if command -v docker &> /dev/null; then
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "Error: ChromaDB server container '$CONTAINER_NAME' is not running."
        echo ""
        echo "Please start the server first with:"
        echo "  ./run-local.sh"
        echo ""
        exit 1
    fi
    echo "✓ ChromaDB server container is running"
else
    echo "Running in container - skipping Docker check"
fi

# Wait for server to be ready
echo "Waiting for ChromaDB server to be ready..."
echo "DEBUG: CHROMA_SERVER_URL = $CHROMA_SERVER_URL"
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "DEBUG: Attempting to connect to $CHROMA_SERVER_URL..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CHROMA_SERVER_URL/" 2>&1)
    CURL_EXIT=$?
    echo "DEBUG: curl exit code: $CURL_EXIT, HTTP code: $HTTP_CODE"
    
    if [ $CURL_EXIT -eq 0 ] && [ "$HTTP_CODE" != "000" ]; then
        echo "✓ ChromaDB server is ready! (HTTP $HTTP_CODE)"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "  Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "Error: ChromaDB server did not become ready in time"
    exit 1
fi

echo ""
echo "This will install Python dependencies if needed..."
echo ""

# Check for Python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Error: Python not found. Please install Python 3."
    exit 1
fi

VENV_DIR=".venv"

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv "$VENV_DIR"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Install dependencies
echo "Installing dependencies (this may take a few minutes)..."
pip install --quiet chromadb sentence-transformers

# Build ChromaDB
echo ""
echo "Building ChromaDB English index against server..."
echo "Server URL: $CHROMA_SERVER_URL"
echo "This will take several minutes to generate embeddings..."
echo ""

# Export CHROMA_SERVER_URL for the build script
export CHROMA_SERVER_URL
python build_chromadb.py --dataset dictionary --lang en

echo ""
echo "Done! Dictionary English index built in ChromaDB server at $CHROMA_SERVER_URL"

