"""
Command to build the search index from dictionary data.
"""

import os
import sys

from core.loader import load_data
from settings import USE_CHROMA, INDEX_PATH, CHROMA_DB_PATH

if USE_CHROMA:
    from core.index_chroma import build_index_chroma as build_index
    INDEX_PATH = CHROMA_DB_PATH
else:
    from core.index import build_index
    from settings import INDEX_PATH


def main():
    """
    Build search index from dictionary data.
    
    Loads dictionary entries from JSON, creates embeddings using sentence transformers,
    and saves the index to disk for fast searching.
    """
    from settings import DATA_PATH
    
    if not os.path.exists(DATA_PATH):
        print(f"Error: Data file not found at {DATA_PATH}")
        sys.exit(1)
    
    print(f"Loading data from {DATA_PATH}...")
    items = load_data()
    print(f"Loaded {len(items)} entries")
    
    print("Building index...")
    build_index(items)
    print("Done!")

