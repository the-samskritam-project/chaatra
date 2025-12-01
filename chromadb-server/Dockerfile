# ChromaDB Server Dockerfile
# Uses official ChromaDB image in server mode with persistent storage

FROM chromadb/chroma:latest

# Set working directory
WORKDIR /chroma

# Configure ChromaDB for persistent mode
ENV IS_PERSISTENT=TRUE
ENV CHROMA_SERVER_HOST=0.0.0.0
ENV CHROMA_SERVER_HTTP_PORT=8000

# Create directory for persistent data
RUN mkdir -p /chroma/chroma

# Expose ChromaDB server port
EXPOSE 8000

# ChromaDB server starts automatically with the image
# Data will be persisted in /chroma/chroma directory
# Mount a volume to this path for persistence

