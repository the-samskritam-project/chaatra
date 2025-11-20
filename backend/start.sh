#!/bin/bash
# Script to build and run the backend Docker container
# Build both ChromaDB indexes first:
#   cd chroma_db && ./build_chromadb_index_en.sh && ./build_chromadb_index_sk.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="chaatra-backend"
CONTAINER_NAME="chaatra-backend"
PORT_8080="${PORT_8080:-8080}"
PORT_8081="${PORT_8081:-8081}"
PORT_8001="${PORT_8001:-8001}"

# Check if ChromaDB database exists
if [ ! -f "$SCRIPT_DIR/chroma_db/chroma.sqlite3" ]; then
    echo "Warning: ChromaDB database not found!"
    echo "Please run: cd chroma_db && ./build_chromadb_index_en.sh && ./build_chromadb_index_sk.sh"
    echo "Continuing anyway..."
fi

echo "Building Docker image..."
docker build -t $IMAGE_NAME .

# Remove existing container if it exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Removing existing container..."
    docker rm -f $CONTAINER_NAME
fi

echo "Starting container..."
docker run -d \
    --name $CONTAINER_NAME \
    -v "$SCRIPT_DIR/chroma_db:/root/chroma_db" \
    -p $PORT_8080:8080 \
    -p $PORT_8081:8081 \
    -p $PORT_8001:8001 \
    $IMAGE_NAME

echo "Container started!"
echo "View logs with: docker logs -f $CONTAINER_NAME"
echo "Stop container with: docker stop $CONTAINER_NAME"
echo ""
echo "Backend is running on:"
echo "  - Port 8080: Go server"
echo "  - Port 8081: Go server (alternative)"
echo "  - Port 8001: ChromaDB bridge service"

