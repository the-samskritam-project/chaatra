"""
Embeddings package for generating vector embeddings using LangChain.
"""

from processor.embeddings.langchain_embeddings import get_embedding_model, generate_embedding

__all__ = ['get_embedding_model', 'generate_embedding']
