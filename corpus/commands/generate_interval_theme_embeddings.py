"""Generate interval theme embeddings command handler."""

import os
import sys

from processor.generate_interval_theme_embeddings import generate_interval_theme_embeddings
from . import register_command


def handle(args):
    """Execute generate_interval_theme_embeddings command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    # Use corpus name if provided, otherwise default to pancatantra
    corpus_name = args.corpus or "pancatantra"
    database_name = args.database or corpus_name
    collection_name = f"{corpus_name}_interval_theme_docs"
    
    api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
    
    generate_interval_theme_embeddings(
        mongodb_uri=mongodb_uri,
        database_name=database_name,
        collection_name=collection_name,
        batch_size=args.batch_size,
        api_key=api_key
    )


register_command('generate_interval_theme_embeddings', handle)

