"""
Search functionality using semantic similarity.

Provides functions for querying the dictionary using vector similarity search.
"""

import numpy as np
from sentence_transformers import SentenceTransformer  # type: ignore
import urllib.request
import urllib.parse
import urllib.error
import json
from .utils import normalize
from settings import MODEL_NAME
from .index import load_index


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


def search(query: str, k=5, transliterate_query: bool = False):
    """
    Search for similar dictionary entries using cosine similarity.
    
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
    # Load index
    items, emb, _ = load_index()
    
    # Transliterate query if requested
    if transliterate_query:
        sanskrit = transliterate_slp1(query)
        if sanskrit:
            # Combine SLP1 and Sanskrit for better matching
            query = f"{query} — {sanskrit}"
        # If transliteration fails, use original query
    
    # Embed query
    qv = embed_query(query)
    
    # Compute cosine similarity (dot product on normalized vectors)
    sims = emb @ qv
    
    # Get top k indices
    top_idx = np.argsort(-sims)[:k]
    
    # Build results
    results = []
    for i in top_idx:
        it = items[i]
        results.append({
            "id": it["id"],
            "sense": it.get("sense", ""),
            "headword": it["headword"],
            "meaning": it["meaning"],
            "partOfSpeech": it.get("partOfSpeech", ""),
            "examples": it.get("examples", []),
            "score": float(sims[i])
        })
    
    return results


def find_other_meanings(headword: str, exclude_id: str):
    """
    Find all other meanings for the same headword.
    
    Used to show related senses when displaying search results.
    
    Args:
        headword: SLP1 headword to search for
        exclude_id: ID to exclude from results (usually the current result)
        
    Returns:
        List of dictionaries containing other meanings, sorted by sense number.
        Each dict has: id, sense, meaning, partOfSpeech, examples
    """
    items, _, _ = load_index()
    other_meanings = []
    
    # Find all entries with the same headword
    for item in items:
        if item["headword"] == headword and item["id"] != exclude_id:
            other_meanings.append({
                "id": item["id"],
                "sense": item.get("sense", ""),
                "meaning": item["meaning"],
                "partOfSpeech": item.get("partOfSpeech", ""),
                "examples": item.get("examples", [])
            })
    
    # Sort by sense number (extract number from "sense_N")
    other_meanings.sort(
        key=lambda x: int(x["sense"].split("_")[1])
        if x["sense"] and "_" in x["sense"] else 999
    )
    
    return other_meanings

