"""Generate theme nodes command handler."""

import os
import sys
import argparse

from processor.generate_theme_nodes import generate_theme_nodes
from . import register_command
from .common_args import add_common_args, add_api_key_arg, add_model_arg


def handle(args):
    """Execute generate_theme_nodes command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    # Use corpus name if provided, otherwise default to pancatantra
    corpus_name = args.corpus or "pancatantra"
    database_name = args.database or corpus_name
    
    api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("Error: OPENAI_API_KEY or LANGCHAIN_API_KEY must be provided or set as environment variable")
        sys.exit(1)
    
    generate_theme_nodes(
        mongodb_uri=mongodb_uri,
        database_name=database_name,
        clusters_collection=args.clusters_collection or f"{corpus_name}_theme_clusters",
        intervals_collection=f"{corpus_name}_interval_theme_docs",
        target_collection=args.theme_nodes_collection or f"{corpus_name}_theme_nodes",
        api_key=api_key,
        model=args.model,
        delay=args.theme_nodes_delay,
        force=args.theme_nodes_force
    )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for generate_theme_nodes command."""
    add_common_args(subparser)
    add_api_key_arg(subparser)
    add_model_arg(subparser)
    subparser.add_argument(
        '--corpus',
        help='Corpus name (defaults to pancatantra if not provided)'
    )
    subparser.add_argument(
        '--clusters-collection',
        help='Source clusters collection (default: {corpus}_theme_clusters)'
    )
    subparser.add_argument(
        '--theme-nodes-collection',
        help='Target theme nodes collection (default: {corpus}_theme_nodes)'
    )
    subparser.add_argument(
        '--theme-nodes-delay',
        type=float,
        default=0.0,
        help='Delay between API calls for theme node generation (seconds, default: 0.0)'
    )
    subparser.add_argument(
        '--theme-nodes-force',
        action='store_true',
        help='Overwrite existing theme nodes'
    )


register_command('generate_theme_nodes', handle, add_arguments, requires_corpus=False)

