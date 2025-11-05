"""
Command to search the dictionary.
"""

import os

from core.loader import load_data
from settings import INDEX_PATH, USE_CHROMA, CHROMA_DB_PATH
from display.output import format_results

# Import appropriate implementation based on settings
if USE_CHROMA:
    from core.search_chroma import search_chroma as search
    from core.index_chroma import build_index_chroma as build_index
    INDEX_PATH = CHROMA_DB_PATH
else:
    from core.search import search
    from core.index import build_index
    from settings import INDEX_PATH


def main(query_text: str, transliterate: bool = False):
    """
    Search the dictionary using semantic similarity.
    
    If no index exists, builds it automatically before searching.
    
    Args:
        query_text: Search query string
        transliterate: If True, transliterate SLP1 query to Sanskrit before searching
    """
    # Build index if it doesn't exist
    if USE_CHROMA:
        # For Chroma, check if collection exists
        try:
            from core.index_chroma import get_chroma_collection
            get_chroma_collection()
        except Exception:
            print("No index found. Building index...")
            items = load_data()
            build_index(items)
            print()
    else:
        # For pickle, check if file exists
        if not os.path.exists(INDEX_PATH):
            print("No index found. Building index...")
            items = load_data()
            build_index(items)
            print()
    
    # Perform semantic search
    results = search(query_text, k=5, transliterate_query=transliterate)
    
    # Format and print results
    output = format_results(query_text, results)
    print(output)

