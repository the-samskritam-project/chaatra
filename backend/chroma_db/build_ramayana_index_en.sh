#!/bin/bash
# Build ChromaDB Ramayana English index locally

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building ChromaDB Ramayana (English) index..."
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

echo ""
echo "Building Ramayana English index..."
python build_chromadb.py --dataset ramayana --lang en

echo ""
echo "Done! Ramayana index built in: $SCRIPT_DIR"

