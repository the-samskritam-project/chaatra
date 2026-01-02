"""Create interval theme docs command handler."""

import os
import sys
import argparse

from processor.create_interval_theme_docs import create_interval_theme_docs
from . import register_command
from .common_args import add_common_args, add_batch_size_arg


def handle(corpus_name: str, args):
    """Execute create_interval_theme_docs command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    create_interval_theme_docs(
        corpus_name=corpus_name,
        mongodb_uri=mongodb_uri,
        database_name=args.database,
        intervals_collection=args.intervals_collection,
        require_summarized=args.require_summarized,
        batch_size=args.batch_size
    )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for create_interval_theme_docs command."""
    add_common_args(subparser)
    add_batch_size_arg(subparser)
    subparser.add_argument(
        '--intervals-collection',
        help='Collection containing intervals (default: {corpus}_intervals)'
    )
    subparser.add_argument(
        '--require-summarized',
        action='store_true',
        help='Skip intervals missing interval_summary or interval_themes'
    )


register_command('create_interval_theme_docs', handle, add_arguments, requires_corpus=True)

