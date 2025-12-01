#!/bin/bash
# Script to run ChromaDB bridge service locally

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="chaatra-chromadb-bridge"
IMAGE_NAME="chaatra-chromadb-bridge:latest"
PORT="${PORT:-8001}"
CHROMA_SERVER_URL="${CHROMA_SERVER_URL:-http://localhost:8000}"

# Build image if it doesn't exist
if ! docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "^${IMAGE_NAME}$"; then
    echo "Building Docker image..."
    docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"
fi

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Removing existing container..."
    docker rm -f "$CONTAINER_NAME"
fi

echo "Starting ChromaDB bridge service..."
echo "  Container name: $CONTAINER_NAME"
echo "  Port: $PORT"
echo "  ChromaDB server: $CHROMA_SERVER_URL"
echo ""

# Determine ChromaDB server host for container networking
# On Mac/Windows, use host.docker.internal; on Linux, use host network or container name
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux: connect to ChromaDB server container by name or use host network
    CHROMA_HOST="chaatra-chromadb-server"
    CHROMA_PORT="8000"
    CHROMA_SERVER_URL_CONTAINER="http://${CHROMA_HOST}:${CHROMA_PORT}"
else
    # Mac/Windows: use host.docker.internal to reach host
    CHROMA_HOST="host.docker.internal"
    CHROMA_PORT="8000"
    CHROMA_SERVER_URL_CONTAINER="http://${CHROMA_HOST}:${CHROMA_PORT}"
fi

# Run bridge service container
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$PORT:8001" \
    -e PORT=8001 \
    -e CHROMA_SERVER_URL="$CHROMA_SERVER_URL_CONTAINER" \
    "$IMAGE_NAME"

echo "ChromaDB bridge service started!"
echo ""
echo "Bridge URL: http://localhost:$PORT"
echo "ChromaDB server: $CHROMA_SERVER_URL"
echo ""
echo "View logs with: docker logs -f $CONTAINER_NAME"
echo "Stop service with: docker stop $CONTAINER_NAME"
echo "Remove service with: docker rm -f $CONTAINER_NAME"

