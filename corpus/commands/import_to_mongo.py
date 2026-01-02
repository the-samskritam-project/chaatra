"""Import to MongoDB command handler."""

import os
import sys

from processor.import_to_mongodb import import_to_mongodb
from . import register_command


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


register_command('import_to_mongo', handle)

