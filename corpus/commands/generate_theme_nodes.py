"""Generate theme nodes command handler."""

import os
import sys

from processor.generate_theme_nodes import generate_theme_nodes
from . import register_command


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


register_command('generate_theme_nodes', handle)

