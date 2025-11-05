#!/usr/bin/env python3
"""
ChromaDB Bridge Service
Generates embeddings and queries ChromaDB for the Go backend.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import chromadb
from sentence_transformers import SentenceTransformer
import os
import sys

app = Flask(__name__)
CORS(app)  # Enable CORS for Go backend

# Configuration
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", os.path.dirname(os.path.abspath(__file__)))
MODEL_NAME = os.getenv("CHROMA_MODEL", "sentence-transformers/paraphrase-multilingual-mpnet-base-v2")

print(f"Initializing ChromaDB bridge...")
print(f"Database path: {CHROMA_DB_PATH}")
print(f"Model: {MODEL_NAME}")

# Initialize ChromaDB client
try:
    client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    collection = client.get_collection(name="dictionary")
    print(f"Connected to ChromaDB collection 'dictionary'")
except Exception as e:
    print(f"Error connecting to ChromaDB: {e}")
    sys.exit(1)

# Initialize embedding model
try:
    model = SentenceTransformer(MODEL_NAME)
    print(f"Loaded embedding model: {MODEL_NAME}")
except Exception as e:
    print(f"Error loading model: {e}")
    sys.exit(1)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "collection": "dictionary"})


@app.route('/query', methods=['POST'])
def query():
    """Query ChromaDB with text, generates embeddings automatically"""
    try:
        data = request.json
        query_text = data.get('query', '')
        n_results = data.get('n_results', 5)
        
        if not query_text:
            return jsonify({"error": "query parameter is required"}), 400
        
        # Generate embedding
        embedding = model.encode([query_text], normalize_embeddings=True)[0]
        
        # Query ChromaDB
        results = collection.query(
            query_embeddings=[embedding.tolist()],
            n_results=n_results,
            include=["documents", "metadatas", "distances"]
        )
        
        # Format results
        formatted_results = []
        if results["ids"] and len(results["ids"]) > 0:
            for i in range(len(results["ids"][0])):
                metadata = results["metadatas"][0][i]
                distance = results["distances"][0][i]
                
                formatted_results.append({
                    "id": results["ids"][0][i],
                    "metadata": metadata,
                    "document": results["documents"][0][i] if results["documents"] else "",
                    "distance": float(distance),
                    "score": float(1.0 - distance)
                })
        
        return jsonify({"results": formatted_results})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv("PORT", 8001))
    print(f"Starting ChromaDB bridge server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)

