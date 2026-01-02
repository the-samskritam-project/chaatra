"""Vector search command handler."""

import os
import sys
import argparse

from processor.search.vector_search import search_semantic
from . import register_command
from .common_args import add_common_args, add_api_key_arg


def handle(args):
    """Execute vector search command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    if not args.query:
        print("Error: Query string is required")
        sys.exit(1)
    
    api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
    
    embedding_model = getattr(args, 'embedding_model', None)
    results = search_semantic(
        query=args.query,
        mongodb_uri=mongodb_uri,
        database_name=args.database,
        collection_name=args.collection,
        corpus_filter=args.corpus,
        limit=args.limit,
        provider=args.provider,
        model_name=embedding_model,
        api_key=api_key
    )
    
    print(f"\nFound {len(results)} results:")
    print("=" * 80)
    for i, result in enumerate(results, 1):
        print(f"\n{i}. Score: {result.get('score', 0):.4f}")
        print(f"   Corpus: {result.get('corpus_name')}")
        verse_num = result.get('verse_number') or result.get('prose_number', 'N/A')
        print(f"   Verse/Prose: {verse_num}")
        print(f"   Chapter: {result.get('chapter_number')}")
        print(f"   Translation: {result.get('full_translation', '')[:200]}...")
        if result.get('original_iast'):
            print(f"   Sanskrit: {result.get('original_iast')[:100]}...")


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for vector_search command."""
    add_common_args(subparser)
    add_api_key_arg(subparser)
    subparser.add_argument(
        '--query',
        required=True,
        help='Search query string'
    )
    subparser.add_argument(
        '--collection',
        default='corpus_vector_search',
        help='Vector search collection name (default: corpus_vector_search)'
    )
    subparser.add_argument(
        '--corpus',
        help='Filter results by corpus name (e.g., hitopadesa, pancatantra)'
    )
    subparser.add_argument(
        '--limit',
        type=int,
        default=10,
        help='Maximum number of search results (default: 10)'
    )
    subparser.add_argument(
        '--provider',
        help='Embedding provider (openai, huggingface)'
    )
    subparser.add_argument(
        '--embedding-model',
        help='Embedding model name (e.g., text-embedding-3-small)'
    )


register_command('vector_search', handle, add_arguments, requires_corpus=False)

