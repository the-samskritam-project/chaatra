"""Cluster interval themes command handler."""

import os
import sys

from processor.cluster_interval_themes import cluster_interval_themes
from . import register_command


def handle(args):
    """Execute cluster_interval_themes command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    # Use corpus name if provided, otherwise default to pancatantra
    corpus_name = args.corpus or "pancatantra"
    database_name = args.database or corpus_name
    source_collection = args.source_collection or f"{corpus_name}_interval_theme_docs"
    target_collection = args.target_collection or f"{corpus_name}_theme_clusters"
    
    cluster_interval_themes(
        mongodb_uri=mongodb_uri,
        database_name=database_name,
        source_collection=source_collection,
        target_collection=target_collection,
        min_cluster_size=args.min_cluster_size,
        min_samples=args.min_samples
    )


register_command('cluster_interval_themes', handle)

