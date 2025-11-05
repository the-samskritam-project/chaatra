"""
Index building and loading functions.

Handles creation and retrieval of the vector search index.
"""

import pickle
import numpy as np
from sentence_transformers import SentenceTransformer
from settings import INDEX_PATH, MODEL_NAME


def build_index(items, model_name=MODEL_NAME, out_path=INDEX_PATH):
    """
    Build and save search index from dictionary items.
    
    Creates embeddings for all items using a sentence transformer model,
    then saves both the items and embeddings to disk as a pickle file.
    
    Args:
        items: List of dictionary items to index
        model_name: Name of the sentence transformer model to use
        out_path: Path where the index will be saved
        
    Note:
        Embeddings are normalized for cosine similarity search.
    """
    # Initialize the embedding model
    model = SentenceTransformer(model_name)
    
    # Extract text to embed
    texts = [it["text"] for it in items]
    
    # Generate embeddings (normalized for cosine similarity)
    emb = model.encode(texts, normalize_embeddings=True)
    emb = np.asarray(emb, dtype=np.float32)
    
    # Save index to disk
    with open(out_path, "wb") as f:
        pickle.dump({
            "items": items,
            "embeddings": emb,
            "model_name": model_name
        }, f)
    
    print(f"Indexed {len(items)} entries → {out_path}")


def load_index(path=INDEX_PATH):
    """
    Load search index from disk.
    
    Args:
        path: Path to the index file
        
    Returns:
        Tuple of (items, embeddings, model_name):
        - items: List of dictionary items
        - embeddings: NumPy array of normalized vectors
        - model_name: Name of the model used to create embeddings
    """
    with open(path, "rb") as f:
        blob = pickle.load(f)
    
    return blob["items"], blob["embeddings"], blob["model_name"]

