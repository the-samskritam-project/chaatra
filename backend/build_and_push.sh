#!/bin/bash
# Build ChromaDB locally, build Docker image, and push to Docker Hub
# This script builds everything locally (fast on M2 Mac) and pushes to Docker Hub
# Railway will pull pre-built images from Docker Hub

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Docker Hub configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-balagi}"
IMAGE_NAME="${IMAGE_NAME:-chaatra-backend}"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"

# Check if ChromaDB is built
if [ ! -f "chroma_db/chroma.sqlite3" ]; then
    echo "🔨 Building ChromaDB indexes locally..."
    cd chroma_db
    ./build_chromadb_index_en.sh
    ./build_chromadb_index_sk.sh
    cd ..
    echo ""
fi

echo "✅ ChromaDB is ready"
echo ""

# Docker Hub authentication
if [ -z "$DOCKER_PASSWORD" ]; then
    echo "🔐 Docker Hub credentials required"
    echo ""
    read -p "Docker Hub Username [$DOCKER_USERNAME]: " input_username
    DOCKER_USERNAME="${input_username:-$DOCKER_USERNAME}"
    
    read -sp "Docker Hub Password/Token: " DOCKER_PASSWORD
    echo ""
    echo ""
fi

# Login to Docker Hub
echo "🔐 Logging in to Docker Hub..."
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

# Generate timestamp tag (yyyy-mm-dd-hhmm format, no colons)
TIMESTAMP=$(date +%Y-%m-%d-%H%M)
VERSION="${VERSION:-${TIMESTAMP}}"

echo "🏗️  Building Docker image for linux/amd64 platform..."
echo "   Image: ${FULL_IMAGE_NAME}:${VERSION}"
echo ""
echo "ℹ️  Note: ChromaDB embeddings are included in the image"
echo ""

docker buildx build --platform linux/amd64 -t "${FULL_IMAGE_NAME}:${VERSION}" --push .

echo ""
echo "✅ Successfully pushed to Docker Hub!"
echo "   ${FULL_IMAGE_NAME}:${VERSION}"
echo ""
echo "🚂 Use this tag in Railway: ${FULL_IMAGE_NAME}:${VERSION}"
echo ""
echo "💡 Tip: Set DOCKER_PASSWORD env var to skip prompt:"
echo "   export DOCKER_PASSWORD=your-token"
echo "   ./build_and_push.sh"
