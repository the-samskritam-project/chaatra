"""
Configuration settings for the search system.

All file paths and model settings are centralized here.
"""

# Path to the parsed dictionary JSON file
DATA_PATH = "data/parsed_dictionary.json"

# Path where the search index will be saved/loaded
INDEX_PATH = "index.pkl"

# Path where the Chroma database will be stored
CHROMA_DB_PATH = "chroma_db"

# Choose implementation: "pickle" or "chroma"
USE_CHROMA = True

# Sentence transformer model for embeddings
# This model supports multilingual text (including Sanskrit and English)
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"

