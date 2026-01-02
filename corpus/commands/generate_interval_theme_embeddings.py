"""Generate interval theme embeddings command handler."""

import os
import sys
import argparse

from processor.generate_interval_theme_embeddings import generate_interval_theme_embeddings
from . import register_command
from .common_args import add_common_args, add_batch_size_arg, add_api_key_arg


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


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for generate_interval_theme_embeddings command."""
    add_common_args(subparser)
    add_batch_size_arg(subparser)
    add_api_key_arg(subparser)
    subparser.add_argument(
        '--corpus',
        help='Corpus name (defaults to pancatantra if not provided)'
    )


register_command('generate_interval_theme_embeddings', handle, add_arguments, requires_corpus=False)

