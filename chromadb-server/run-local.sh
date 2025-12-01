#!/bin/bash
# Script to run ChromaDB server locally with Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="chaatra-chromadb-server"
IMAGE_NAME="chromadb/chroma:latest"
PORT="${PORT:-8000}"
DATA_DIR="${DATA_DIR:-$SCRIPT_DIR/data}"

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Removing existing container..."
    docker rm -f "$CONTAINER_NAME"
fi

echo "Starting ChromaDB server..."
echo "  Container name: $CONTAINER_NAME"
echo "  Port: $PORT"
echo "  Data directory: $DATA_DIR"
echo ""

# Run ChromaDB server container
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$PORT:8000" \
    -v "$DATA_DIR:/chroma/chroma" \
    -e IS_PERSISTENT=TRUE \
    -e CHROMA_SERVER_HOST=0.0.0.0 \
    -e CHROMA_SERVER_HTTP_PORT=8000 \
    "$IMAGE_NAME"

echo "ChromaDB server started!"
echo ""
echo "Server URL: http://localhost:$PORT"
echo "Data persisted in: $DATA_DIR"
echo ""
echo "View logs with: docker logs -f $CONTAINER_NAME"
echo "Stop server with: docker stop $CONTAINER_NAME"
echo "Remove server with: docker rm -f $CONTAINER_NAME"

