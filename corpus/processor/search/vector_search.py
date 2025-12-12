"""
Vector search utilities for MongoDB Atlas vector search.

Supports both MongoDB Atlas vector search and fallback cosine similarity
for local MongoDB without vector search support.
"""

import os
import numpy as np
from typing import List, Dict, Optional, Tuple
from pymongo import MongoClient
from pymongo.errors import OperationFailure

from processor.embeddings.langchain_embeddings import get_embedding_model, generate_embedding


def check_vector_search_support(client: MongoClient, database_name: str, collection_name: str) -> bool:
    """
    Check if MongoDB supports vector search for the given collection.
    
    Args:
        client: MongoDB client
        database_name: Database name
        collection_name: Collection name
    
    Returns:
        True if vector search is supported, False otherwise
    """
    try:
        db = client[database_name]
        
        # Try to check if search indexes are supported
        # For local MongoDB, vector search indexes may not be available
        # We'll return False and use fallback cosine similarity
        try:
            # Try using admin command to check
            result = db.command("listSearchIndexes", collection_name)
            # If command works, vector search might be available
            return True
        except (OperationFailure, AttributeError):
            # Vector search not supported - use fallback
            return False
    except (OperationFailure, AttributeError, TypeError):
        # Vector search not supported
        return False


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors.
    
    Args:
        vec1: First vector
        vec2: Second vector
    
    Returns:
        Cosine similarity score (0-1, higher is more similar)
    """
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return float(dot_product / (norm1 * norm2))


def search_semantic(
    query: str,
    mongodb_uri: str,
    database_name: Optional[str] = None,
    collection_name: str = "corpus_vector_search",
    corpus_filter: Optional[str] = None,
    limit: int = 10,
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None
) -> List[Dict]:
    """
    Perform semantic search using MongoDB vector search or fallback cosine similarity.
    
    Args:
        query: Search query text
        mongodb_uri: MongoDB connection URI
        database_name: Database name containing vector search collection
        collection_name: Collection name (default: corpus_vector_search)
        corpus_filter: Optional corpus name filter (e.g., 'hitopadesa', 'pancatantra')
        limit: Maximum number of results to return (default: 10)
        provider: Embedding provider (optional, uses env vars if not provided)
        model_name: Model identifier (optional, uses env vars if not provided)
        api_key: API key (optional, uses env vars if not provided)
    
    Returns:
        List of result dictionaries, each containing:
        - document_id: Reference to original document
        - corpus_name: Corpus name
        - verse_number or prose_number: Verse/prose identifier
        - full_translation: Translation text
        - original_iast: Sanskrit text
        - score: Similarity score
        - metadata: Additional metadata
    """
    # Connect to MongoDB
    client = MongoClient(mongodb_uri)
    
    # Get database name from env if not provided
    if database_name is None:
        database_name = os.getenv('MONGODB_VECTOR_DATABASE') or os.getenv('MONGODB_DATABASE', 'hitopadesa')
    
    db = client[database_name]
    collection = db[collection_name]
    
    # Generate query embedding
    query_embedding = generate_embedding(query, provider=provider, model_name=model_name, api_key=api_key)
    
    # Check if vector search is supported
    has_vector_search = check_vector_search_support(client, database_name, collection_name)
    
    if has_vector_search:
        # Use MongoDB Atlas vector search
        return _search_with_vector_index(
            collection, query_embedding, corpus_filter, limit
        )
    else:
        # Fallback to cosine similarity search
        return _search_with_cosine_similarity(
            collection, query_embedding, corpus_filter, limit
        )


def _search_with_vector_index(
    collection,
    query_embedding: List[float],
    corpus_filter: Optional[str],
    limit: int
) -> List[Dict]:
    """
    Search using MongoDB Atlas vector search index.
    
    Args:
        collection: MongoDB collection
        query_embedding: Query embedding vector
        corpus_filter: Optional corpus name filter
        limit: Maximum number of results
    
    Returns:
        List of result dictionaries
    """
    # Build aggregation pipeline for vector search
    pipeline = [
        {
            "$vectorSearch": {
                "index": "corpus_translation_vector_index",
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": limit * 10,  # Search more candidates for better results
                "limit": limit
            }
        }
    ]
    
    # Add corpus filter if specified
    if corpus_filter:
        pipeline.append({
            "$match": {
                "corpus_name": corpus_filter
            }
        })
    
    # Project fields
    pipeline.append({
        "$project": {
            "document_id": 1,
            "corpus_name": 1,
            "verse_number": 1,
            "prose_number": 1,
            "chapter_number": 1,
            "full_translation": 1,
            "original_iast": 1,
            "score": {"$meta": "vectorSearchScore"},
            "metadata": 1
        }
    })
    
    try:
        results = list(collection.aggregate(pipeline))
        return results
    except OperationFailure as e:
        # If vector search fails, fall back to cosine similarity
        print(f"Warning: Vector search failed, falling back to cosine similarity: {e}")
        return _search_with_cosine_similarity(collection, query_embedding, corpus_filter, limit)


def _search_with_cosine_similarity(
    collection,
    query_embedding: List[float],
    corpus_filter: Optional[str],
    limit: int
) -> List[Dict]:
    """
    Search using cosine similarity (fallback for MongoDB without vector search).
    
    Args:
        collection: MongoDB collection
        query_embedding: Query embedding vector
        corpus_filter: Optional corpus name filter
        limit: Maximum number of results
    
    Returns:
        List of result dictionaries
    """
    # Build query filter
    query_filter = {}
    if corpus_filter:
        query_filter["corpus_name"] = corpus_filter
    
    # Fetch all documents (or filtered documents)
    # Note: This is less efficient for large collections, but works without vector search
    documents = list(collection.find(query_filter, {
        "embedding": 1,
        "document_id": 1,
        "corpus_name": 1,
        "verse_number": 1,
        "prose_number": 1,
        "chapter_number": 1,
        "full_translation": 1,
        "original_iast": 1,
        "metadata": 1
    }))
    
    # Calculate cosine similarity for each document
    results = []
    for doc in documents:
        if "embedding" not in doc:
            continue
        
        similarity = cosine_similarity(query_embedding, doc["embedding"])
        result = {
            "document_id": doc.get("document_id"),
            "corpus_name": doc.get("corpus_name"),
            "verse_number": doc.get("verse_number"),
            "prose_number": doc.get("prose_number"),
            "chapter_number": doc.get("chapter_number"),
            "full_translation": doc.get("full_translation"),
            "original_iast": doc.get("original_iast"),
            "score": similarity,
            "metadata": doc.get("metadata", {})
        }
        results.append(result)
    
    # Sort by similarity score (descending) and return top results
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]


def create_vector_search_index(
    mongodb_uri: str,
    database_name: str,
    collection_name: str = "corpus_vector_search",
    index_name: str = "corpus_translation_vector_index",
    dimension: int = 1536  # Default for OpenAI text-embedding-3-small
) -> bool:
    """
    Create a vector search index in MongoDB Atlas.
    
    Note: This function provides the index definition. The actual index creation
    should be done via MongoDB Atlas UI or Atlas CLI for production.
    
    Args:
        mongodb_uri: MongoDB connection URI
        database_name: Database name
        collection_name: Collection name
        index_name: Index name
        dimension: Embedding dimension (default: 1536 for OpenAI text-embedding-3-small)
    
    Returns:
        True if index creation was attempted, False otherwise
    
    Note:
        Vector search indexes in MongoDB Atlas typically need to be created
        via the Atlas UI or Atlas CLI. This function provides the definition
        for reference.
    """
    index_definition = {
        "name": index_name,
        "type": "vectorSearch",
        "definition": {
            "fields": [
                {
                    "type": "vector",
                    "path": "embedding",
                    "numDimensions": dimension,
                    "similarity": "cosine"
                }
            ]
        }
    }
    
    print(f"Vector search index definition:")
    print(f"  Index name: {index_name}")
    print(f"  Collection: {database_name}.{collection_name}")
    print(f"  Dimension: {dimension}")
    print(f"  Similarity: cosine")
    print(f"\nTo create this index in MongoDB Atlas:")
    print(f"  1. Go to Atlas UI -> Search -> Create Search Index")
    print(f"  2. Use JSON Editor and paste the definition above")
    print(f"  3. Or use Atlas CLI: atlas clusters search indexes create")
    print(f"\nIndex definition JSON:")
    import json
    print(json.dumps(index_definition, indent=2))
    
    return True
