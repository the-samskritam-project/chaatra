"""
Chroma-based index building and loading functions.

Chroma vector database implementation maintaining same interface as pickle-based index.
"""

import numpy as np
import chromadb
from sentence_transformers import SentenceTransformer
from settings import CHROMA_DB_PATH, MODEL_NAME


def build_index_chroma(items, model_name=MODEL_NAME, out_path=CHROMA_DB_PATH):
    """
    Build and save search index using Chroma vector database.
    
    Creates embeddings for all items using a sentence transformer model,
    then stores both the items and embeddings in Chroma.
    
    Args:
        items: List of dictionary items to index
        model_name: Name of the sentence transformer model to use
        out_path: Path where the Chroma database will be stored
        
    Note:
        Embeddings are normalized for cosine similarity search.
        Maintains same interface as build_index() for compatibility.
    """
    # Initialize Chroma client with persistent storage
    client = chromadb.PersistentClient(path=out_path)
    
    # Get or create collection
    collection = client.get_or_create_collection(
        name="dictionary",
        metadata={"model_name": model_name}
    )
    
    # Initialize the embedding model
    model = SentenceTransformer(model_name)
    
    # Extract text to embed
    texts = [it["text"] for it in items]
    
    # Generate embeddings (normalized for cosine similarity)
    embeddings = model.encode(texts, normalize_embeddings=True)
    embeddings = np.asarray(embeddings, dtype=np.float32)
    
    # Prepare metadata (all fields except text which is the document)
    import json
    metadatas = []
    for it in items:
        metadata = {
            "sense": it.get("sense", ""),
            "headword": it.get("headword", ""),
            "meaning": it.get("meaning", ""),
            "partOfSpeech": it.get("partOfSpeech", ""),
        }
        # Store examples as JSON string (Chroma metadata must be strings/numbers)
        metadata["examples"] = json.dumps(it.get("examples", []))
        metadatas.append(metadata)
    
    # Add to Chroma collection in batches (Chroma has a max batch size limit)
    batch_size = 5000  # Safe batch size below Chroma's limit
    total_items = len(items)
    
    for i in range(0, total_items, batch_size):
        batch_end = min(i + batch_size, total_items)
        batch_ids = [it["id"] for it in items[i:batch_end]]
        batch_documents = texts[i:batch_end]
        batch_embeddings = embeddings[i:batch_end].tolist()
        batch_metadatas = metadatas[i:batch_end]
        
        collection.add(
            ids=batch_ids,
            embeddings=batch_embeddings,
            documents=batch_documents,
            metadatas=batch_metadatas
        )
        
        print(f"Indexed batch {i//batch_size + 1}: {batch_end}/{total_items} entries", end='\r')
    
    print(f"\nIndexed {total_items} entries → Chroma DB at {out_path}")


def load_index_chroma(path=CHROMA_DB_PATH):
    """
    Load search index from Chroma database.
    
    Args:
        path: Path to the Chroma database directory
        
    Returns:
        Tuple of (items, embeddings, model_name):
        - items: List of dictionary items (same format as pickle version)
        - embeddings: NumPy array of normalized vectors (for compatibility)
        - model_name: Name of the model used to create embeddings
        
    Note:
        Returns same format as load_index() for compatibility.
        However, Chroma is used for actual search operations.
    """
    # Initialize Chroma client
    client = chromadb.PersistentClient(path=path)
    
    # Get collection
    collection = client.get_collection(name="dictionary")
    
    # Get model name from collection metadata
    model_name = collection.metadata.get("model_name", MODEL_NAME)
    
    # Get all data from Chroma
    results = collection.get(include=["embeddings", "documents", "metadatas"])
    
    # Reconstruct items list (same format as pickle version)
    items = []
    import json
    
    for i, doc_id in enumerate(results["ids"]):
        metadata = results["metadatas"][i]
        item = {
            "id": doc_id,
            "sense": metadata.get("sense", ""),
            "headword": metadata.get("headword", ""),
            "meaning": metadata.get("meaning", ""),
            "partOfSpeech": metadata.get("partOfSpeech", ""),
            "examples": json.loads(metadata.get("examples", "[]")),
            "text": results["documents"][i]
        }
        items.append(item)
    
    # Extract embeddings as numpy array (for compatibility)
    embeddings = np.array(results["embeddings"], dtype=np.float32)
    
    return items, embeddings, model_name


def get_chroma_collection(path=CHROMA_DB_PATH):
    """
    Get Chroma collection for direct use in search operations.
    
    Args:
        path: Path to the Chroma database directory
        
    Returns:
        Chroma collection object
    """
    client = chromadb.PersistentClient(path=path)
    return client.get_collection(name="dictionary")

