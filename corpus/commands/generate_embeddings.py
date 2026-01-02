"""Generate embeddings command handler."""

import os
import sys
import argparse

from processor.generate_embeddings import generate_embeddings_for_corpus
from . import register_command
from .common_args import add_common_args, add_batch_size_arg, add_api_key_arg


def handle(corpus_name: str, args):
    """Execute embedding generation command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("Error: LANGCHAIN_API_KEY or OPENAI_API_KEY must be provided or set as environment variable")
        sys.exit(1)
    
    generate_embeddings_for_corpus(
        corpus_name=corpus_name,
        mongodb_uri=mongodb_uri,
        database_name=args.database,
        vector_database=args.vector_database,
        vector_collection=args.vector_collection,
        batch_size=args.batch_size,
        skip_existing=not args.no_skip_existing,
        provider=args.provider,
        model_name=getattr(args, 'embedding_model', None),
        api_key=api_key
    )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for generate_embeddings command."""
    add_common_args(subparser)
    add_batch_size_arg(subparser)
    add_api_key_arg(subparser)
    subparser.add_argument(
        '--vector-database',
        help='Database name for vector collection (defaults to corpus database)'
    )
    subparser.add_argument(
        '--vector-collection',
        default='corpus_vector_search',
        help='Vector collection name (default: corpus_vector_search)'
    )
    subparser.add_argument(
        '--no-skip-existing',
        action='store_true',
        help='Regenerate embeddings for existing documents'
    )
    subparser.add_argument(
        '--provider',
        help='Embedding provider (openai, huggingface)'
    )
    subparser.add_argument(
        '--embedding-model',
        help='Embedding model name (e.g., text-embedding-3-small)'
    )


register_command('generate_embeddings', handle, add_arguments, requires_corpus=True)

