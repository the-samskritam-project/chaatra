# ChromaDB Bridge Service Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    flask \
    flask-cors \
    chromadb \
    sentence-transformers

# Pre-download the sentence transformer model during build
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-mpnet-base-v2')"

# Copy bridge service
COPY chromadb_bridge.py .

# Expose port
EXPOSE 8001

# Run the bridge service
CMD ["python", "chromadb_bridge.py"]

