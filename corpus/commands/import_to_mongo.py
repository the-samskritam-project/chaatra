"""Import to MongoDB command handler."""

import os
import sys
import argparse

from processor.import_to_mongodb import import_to_mongodb
from . import register_command
from .common_args import add_common_args


def handle(corpus_name: str, args):
    """Execute import to MongoDB command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    import_to_mongodb(
        corpus_name=corpus_name,
        mongodb_uri=mongodb_uri,
        database_name=args.database,
        clear_existing=args.clear_existing
    )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for import_to_mongo command."""
    add_common_args(subparser)
    subparser.add_argument(
        '--clear-existing',
        action='store_true',
        help='Clear existing collections before importing'
    )


register_command('import_to_mongo', handle, add_arguments, requires_corpus=True)

