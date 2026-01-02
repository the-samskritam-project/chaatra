"""Create interval theme docs command handler."""

import os
import sys

from processor.create_interval_theme_docs import create_interval_theme_docs
from . import register_command


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


register_command('create_interval_theme_docs', handle)

