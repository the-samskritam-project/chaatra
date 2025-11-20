# Use an official Go runtime as a parent image
FROM golang:1.25 AS builder

# Set the working directory inside the container
WORKDIR /go/src/chaatra/backend

# Copy the local package files to the container's workspace
COPY . .

# Download any necessary dependencies
# Ensure to copy go.mod and go.sum files before running go mod download
RUN go mod download

# Build your application statically
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o samskritam .

# Use Python base image to run ChromaDB and bridge services
FROM python:3.11-slim

# Set the working directory
WORKDIR /root/

# Install system dependencies
RUN apt-get update && apt-get install -y \
    bash \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Import the compiled executable from the first stage
COPY --from=builder /go/src/chaatra/backend/samskritam /root/samskritam

# Import the dictionary.xml file
COPY --from=builder /go/src/chaatra/backend/core/parser/dictionary.xml /root/dictionary.xml

# Copy ChromaDB bridge script and built database files
RUN mkdir -p /root/chroma_db
COPY --from=builder /go/src/chaatra/backend/chroma_db/chromadb_bridge.py /root/chroma_db/chromadb_bridge.py
COPY --from=builder /go/src/chaatra/backend/chroma_db/valmiki_ramayan_shlokas_filtered.json /root/chroma_db/valmiki_ramayan_shlokas_filtered.json

# Copy built ChromaDB index files (from artifact download in CI, or empty locally)
# These files will be included when built via GitHub Actions
# Note: chromadb_bridge.py is already copied above, so copying the directory will merge additional files
COPY --from=builder /go/src/chaatra/backend/chroma_db/ /root/chroma_db/

# Set up ChromaDB directory
WORKDIR /root/chroma_db

# Install PyTorch CPU-only first (prevents CUDA dependencies)
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies for ChromaDB
RUN pip install --no-cache-dir chromadb flask flask-cors sentence-transformers

# Pre-download the sentence transformer model during build
# This avoids long startup delays when the container starts
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-mpnet-base-v2')"

# Ensure executable permissions for Go binary
RUN chmod +x /root/samskritam

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Start ChromaDB bridge service in background\n\
echo "Starting ChromaDB bridge service..."\n\
cd /root/chroma_db\n\
export CHROMA_DB_PATH=/root/chroma_db\n\
export BRIDGE_PORT=8001\n\
PORT=$BRIDGE_PORT python chromadb_bridge.py &\n\
\n\
# Give bridge service time to initialize (model loading is already done during build)\n\
echo "Waiting for bridge service to initialize..."\n\
sleep 10\n\
\n\
# Start Go server\n\
echo "Starting Go server..."\n\
cd /root\n\
export CHROMA_URL=http://localhost:8000\n\
export CHROMA_BRIDGE_URL=http://localhost:8001\n\
# Use Railway PORT if set, otherwise default to 8081\n\
if [ -z "$PORT" ]; then\n\
  export PORT=8081\n\
fi\n\
exec /root/samskritam\n\
' > /root/start.sh && chmod +x /root/start.sh

# Expose ports
EXPOSE 8001 8080 8081

# Command to run the startup script
CMD ["/root/start.sh"]
