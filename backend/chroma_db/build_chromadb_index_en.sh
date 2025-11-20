#!/bin/bash
# Build ChromaDB English index locally
# Run this script to generate embeddings (SLP1 + English) before starting Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building ChromaDB English index locally..."
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
echo "Building ChromaDB English index..."
echo "This will take several minutes to generate embeddings..."
python build_chromadb.py --lang en

echo ""
echo "Done! English ChromaDB index built in: $SCRIPT_DIR"
echo "Remember to also build the Sanskrit index with: ./build_chromadb_index_sk.sh"

