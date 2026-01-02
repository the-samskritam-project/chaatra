"""Build intervals command handler."""

import os
import sys

from processor.build_intervals import build_intervals
from . import register_command


def handle(corpus_name: str, args):
    """Execute build_intervals command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    build_intervals(
        corpus_name=corpus_name,
        mongodb_uri=mongodb_uri,
        database_name=args.database,
        output_collection=args.output_collection,
        label_field=args.interval_label_field,
        start_chapter=args.interval_start_chapter,
        end_chapter=args.interval_end_chapter,
        max_per_chapter=args.interval_max_per_chapter,
        verses_only=args.verses_only,
        clear_output=not args.keep_output
    )


register_command('build_intervals', handle)

