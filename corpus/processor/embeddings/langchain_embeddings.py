"""
LangChain integration for embedding generation.

Supports multiple embedding providers (OpenAI, HuggingFace, etc.)
configurable via environment variables.
"""

import os
from typing import List, Optional
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import HuggingFaceEmbeddings


# Default embedding model
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
DEFAULT_EMBEDDING_PROVIDER = "openai"


def get_embedding_model(
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    dimensions: Optional[int] = None
):
    """
    Get an embedding model instance using LangChain.
    
    Args:
        provider: Embedding provider ('openai', 'huggingface', etc.)
                 If None, reads from LANGCHAIN_EMBEDDING_PROVIDER env var
        model_name: Model identifier (e.g., 'text-embedding-3-small')
                    If None, reads from LANGCHAIN_EMBEDDING_MODEL env var
        api_key: API key for the provider
                If None, reads from LANGCHAIN_API_KEY or OPENAI_API_KEY env var
        dimensions: Number of dimensions for embeddings (OpenAI only, e.g., 384)
                   If None, reads from LANGCHAIN_EMBEDDING_DIMENSIONS env var
    
    Returns:
        Embedding model instance (LangChain Embeddings object)
    
    Raises:
        ValueError: If provider is not supported or required config is missing
    """
    # Get configuration from environment or parameters
    provider = provider or os.getenv('LANGCHAIN_EMBEDDING_PROVIDER', DEFAULT_EMBEDDING_PROVIDER).lower()
    model_name = model_name or os.getenv('LANGCHAIN_EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL)
    
    # Get dimensions for OpenAI
    if dimensions is None:
        dims_str = os.getenv('LANGCHAIN_EMBEDDING_DIMENSIONS')
        if dims_str:
            try:
                dimensions = int(dims_str)
            except ValueError:
                dimensions = None
    
    # Get API key
    if api_key is None:
        api_key = os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
    
    if provider == 'openai':
        if not api_key:
            raise ValueError(
                "OpenAI API key required. Set LANGCHAIN_API_KEY or OPENAI_API_KEY environment variable."
            )
        # Ensure model_name is not None - use default if still None
        if not model_name:
            model_name = DEFAULT_EMBEDDING_MODEL
        
        # Build kwargs for OpenAIEmbeddings
        kwargs = {
            'model': model_name,
            'openai_api_key': api_key
        }
        
        # Add dimensions if specified (for text-embedding-3 models)
        if dimensions is not None:
            kwargs['dimensions'] = dimensions
        
        return OpenAIEmbeddings(**kwargs)
    
    elif provider == 'huggingface':
        # HuggingFace embeddings don't require API key for local models
        return HuggingFaceEmbeddings(
            model_name=model_name
        )
    
    else:
        raise ValueError(
            f"Unsupported embedding provider: {provider}. "
            f"Supported providers: 'openai', 'huggingface'"
        )


def generate_embedding(
    text: str,
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None
) -> List[float]:
    """
    Generate a single embedding vector for text.
    
    Args:
        text: Text to embed
        provider: Embedding provider (optional, uses env vars if not provided)
        model_name: Model identifier (optional, uses env vars if not provided)
        api_key: API key (optional, uses env vars if not provided)
    
    Returns:
        List of floats representing the embedding vector
    """
    model = get_embedding_model(provider=provider, model_name=model_name, api_key=api_key)
    return model.embed_query(text)


def generate_embeddings_batch(
    texts: List[str],
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    batch_size: int = 100
) -> List[List[float]]:
    """
    Generate embeddings for a batch of texts.
    
    Args:
        texts: List of texts to embed
        provider: Embedding provider (optional, uses env vars if not provided)
        model_name: Model identifier (optional, uses env vars if not provided)
        api_key: API key (optional, uses env vars if not provided)
        batch_size: Batch size for processing (default: 100)
    
    Returns:
        List of embedding vectors (each is a list of floats)
    """
    model = get_embedding_model(provider=provider, model_name=model_name, api_key=api_key)
    return model.embed_documents(texts)
