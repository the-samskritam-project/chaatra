"""
Chroma-based search functionality using semantic similarity.

Provides functions for querying the dictionary using Chroma vector database.
Maintains same interface as pickle-based search for compatibility.
"""

import numpy as np
from sentence_transformers import SentenceTransformer  # type: ignore
import urllib.request
import urllib.parse
import urllib.error
import json
from .utils import normalize
from settings import MODEL_NAME
from .index_chroma import get_chroma_collection


# Global model cache to avoid reloading
_model_cache = {}


def transliterate_slp1(slp1: str) -> str:
    """
    Transliterate SLP1 string to Devanagari Sanskrit using the local API.
    
    Args:
        slp1: SLP1 transliteration string
        
    Returns:
        Devanagari Sanskrit string, or empty string on error
    """
    if not slp1 or not slp1.strip():
        return ""
    
    try:
        url = f"http://localhost:8081/transliterate?slp1={urllib.parse.quote(slp1)}"
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get("devanagari", "")
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, KeyError, TimeoutError):
        # Silently return empty string on any error
        return ""


def get_model():
    """
    Get or create the sentence transformer model.
    
    Caches the model to avoid reloading on every query.
    
    Returns:
        SentenceTransformer model instance
    """
    if "model" not in _model_cache:
        _model_cache["model"] = SentenceTransformer(MODEL_NAME)
    return _model_cache["model"]


def embed_query(q: str):
    """
    Embed a query string into a vector for similarity search.
    
    Args:
        q: Query string to embed
        
    Returns:
        Normalized NumPy array representing the query vector
    """
    q = normalize(q)
    model = get_model()
    vec = model.encode([q], normalize_embeddings=True)
    return np.asarray(vec[0], dtype=np.float32)


def search_chroma(query: str, k=5, transliterate_query: bool = False):
    """
    Search for similar dictionary entries using Chroma vector database.
    
    Args:
        query: Search query string
        k: Number of top results to return (default: 5)
        transliterate_query: If True, transliterate SLP1 query to Sanskrit before searching
        
    Returns:
        List of dictionaries, each containing:
        - id: Entry identifier
        - sense: Sense number
        - headword: SLP1 transliteration
        - meaning: English definition
        - partOfSpeech: Part of speech
        - examples: List of examples
        - score: Similarity score (0-1, higher is better)
    """
    # Get Chroma collection
    collection = get_chroma_collection()
    
    # Transliterate query if requested
    if transliterate_query:
        sanskrit = transliterate_slp1(query)
        if sanskrit:
            # Combine SLP1 and Sanskrit for better matching
            query = f"{query} — {sanskrit}"
        # If transliteration fails, use original query
    
    # Embed query
    qv = embed_query(query)
    
    # Query Chroma collection
    results = collection.query(
        query_embeddings=[qv.tolist()],
        n_results=k,
        include=["documents", "metadatas", "distances"]
    )
    
    # Build results in same format as pickle version
    output_results = []
    import json as json_lib
    
    if results["ids"] and len(results["ids"]) > 0:
        for i in range(len(results["ids"][0])):
            doc_id = results["ids"][0][i]
            metadata = results["metadatas"][0][i]
            distance = results["distances"][0][i]
            
            # Convert distance to similarity score (Chroma uses distance, we want similarity)
            # For normalized embeddings, distance = 1 - cosine_similarity
            score = 1.0 - distance
            
            output_results.append({
                "id": doc_id,
                "sense": metadata.get("sense", ""),
                "headword": metadata.get("headword", ""),
                "meaning": metadata.get("meaning", ""),
                "partOfSpeech": metadata.get("partOfSpeech", ""),
                "examples": json_lib.loads(metadata.get("examples", "[]")),
                "score": float(score)
            })
    
    return output_results


def find_other_meanings_chroma(headword: str, exclude_id: str):
    """
    Find all other meanings for the same headword using Chroma metadata filtering.
    
    Used to show related senses when displaying search results.
    
    Args:
        headword: SLP1 headword to search for
        exclude_id: ID to exclude from results (usually the current result)
        
    Returns:
        List of dictionaries containing other meanings, sorted by sense number.
        Each dict has: id, sense, meaning, partOfSpeech, examples
    """
    collection = get_chroma_collection()
    
    # Query Chroma with metadata filter
    results = collection.get(
        where={"headword": headword},
        include=["metadatas"]
    )
    
    other_meanings = []
    import json as json_lib
    
    for i, doc_id in enumerate(results["ids"]):
        if doc_id == exclude_id:
            continue
        
        metadata = results["metadatas"][i]
        other_meanings.append({
            "id": doc_id,
            "sense": metadata.get("sense", ""),
            "meaning": metadata.get("meaning", ""),
            "partOfSpeech": metadata.get("partOfSpeech", ""),
            "examples": json_lib.loads(metadata.get("examples", "[]"))
        })
    
    # Sort by sense number (extract number from "sense_N")
    other_meanings.sort(
        key=lambda x: int(x["sense"].split("_")[1])
        if x["sense"] and "_" in x["sense"] else 999
    )
    
    return other_meanings

