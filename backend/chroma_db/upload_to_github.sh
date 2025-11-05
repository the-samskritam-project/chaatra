#!/bin/bash
# Helper script to build ChromaDB locally and upload to GitHub Actions
# This script builds ChromaDB on your local machine (fast!) and triggers
# the upload workflow to store it as an artifact for CI use.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔨 Building ChromaDB index locally..."
echo ""

# Build ChromaDB locally
./build_chromadb_index.sh

echo ""
echo "✅ ChromaDB built successfully!"
echo ""
echo "📤 To upload to GitHub Actions:"
echo "   1. Go to: https://github.com/YOUR_REPO/actions/workflows/upload-chromadb.yml"
echo "   2. Click 'Run workflow'"
echo "   3. The workflow will detect your local ChromaDB files and upload them"
echo ""
echo "Alternatively, commit and push the workflow file, then run:"
echo "   gh workflow run upload-chromadb.yml"
echo ""

# Check if GitHub CLI is available
if command -v gh &> /dev/null; then
    echo "🔍 GitHub CLI detected. Would you like to upload now? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "🚀 Triggering upload workflow..."
        gh workflow run upload-chromadb.yml
        echo "✅ Workflow triggered! Check status at:"
        echo "   https://github.com/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/actions"
    fi
else
    echo "💡 Install GitHub CLI (gh) for automated uploads:"
    echo "   brew install gh"
fi

