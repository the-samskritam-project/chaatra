"""
Search package for vector search functionality.
"""

from processor.search.vector_search import (
    search_semantic,
    check_vector_search_support
)

__all__ = ['search_semantic', 'check_vector_search_support']
