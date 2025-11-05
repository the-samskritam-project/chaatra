#!/bin/bash
# Script to start ChromaDB bridge service (Python service that generates embeddings)
# Usage: ./start_chromadb_bridge.sh

cd "$(dirname "$0")"

CHROMA_DB_PATH="."
BRIDGE_PORT="${BRIDGE_PORT:-8001}"
VENV_DIR=".venv"

echo "Starting ChromaDB Bridge Service..."
echo "Database path: $CHROMA_DB_PATH"
echo "Port: $BRIDGE_PORT"

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
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Install dependencies if needed
if ! python -c "import flask" 2>/dev/null; then
    echo "Installing Python dependencies..."
    pip install --quiet flask flask-cors chromadb sentence-transformers
fi

# Set environment variables
export CHROMA_DB_PATH="$CHROMA_DB_PATH"
export PORT="$BRIDGE_PORT"

# Start the bridge service
echo "Starting bridge service..."
python chromadb_bridge.py

