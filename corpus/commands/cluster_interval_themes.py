"""Cluster interval themes command handler."""

import os
import sys
import argparse

from processor.cluster_interval_themes import cluster_interval_themes
from . import register_command
from .common_args import add_common_args


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


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for cluster_interval_themes command."""
    add_common_args(subparser)
    subparser.add_argument(
        '--corpus',
        help='Corpus name (defaults to pancatantra if not provided)'
    )
    subparser.add_argument(
        '--source-collection',
        help='Source collection for clustering (default: {corpus}_interval_theme_docs)'
    )
    subparser.add_argument(
        '--target-collection',
        help='Target collection for clusters (default: {corpus}_theme_clusters)'
    )
    subparser.add_argument(
        '--min-cluster-size',
        type=int,
        default=5,
        help='Minimum cluster size for HDBSCAN (default: 5)'
    )
    subparser.add_argument(
        '--min-samples',
        type=int,
        default=5,
        help='Minimum samples for HDBSCAN (default: 5)'
    )


register_command('cluster_interval_themes', handle, add_arguments, requires_corpus=False)

