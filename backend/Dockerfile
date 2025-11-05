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

# Copy ChromaDB bridge script only (database will be mounted as volume)
RUN mkdir -p /root/chroma_db
COPY --from=builder /go/src/chaatra/backend/chroma_db/chromadb_bridge.py /root/chroma_db/chromadb_bridge.py

# Set up ChromaDB directory
WORKDIR /root/chroma_db

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
export PORT=8001\n\
python chromadb_bridge.py &\n\
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
export PORT=8081\n\
exec /root/samskritam\n\
' > /root/start.sh && chmod +x /root/start.sh

# Expose ports
EXPOSE 8001 8080 8081

# Command to run the startup script
CMD ["/root/start.sh"]
