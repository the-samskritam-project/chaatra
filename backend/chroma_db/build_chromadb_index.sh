#!/bin/bash
# Build ChromaDB index locally
# Run this script to generate embeddings before starting Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building ChromaDB index locally..."
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

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv .venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate

# Install dependencies
echo "Installing dependencies (this may take a few minutes)..."
pip install --quiet chromadb sentence-transformers

# Build ChromaDB
echo ""
echo "Building ChromaDB index..."
echo "This will take several minutes to generate embeddings..."
python build_chromadb.py

echo ""
echo "Done! ChromaDB index built in: $SCRIPT_DIR"
echo "You can now run: cd .. && ./start.sh"

