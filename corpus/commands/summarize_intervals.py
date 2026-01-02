"""Summarize intervals command handler."""

import os
import sys

from processor.summarize_intervals import summarize_intervals
from . import register_command


def handle(corpus_name: str, args):
    """Execute summarize_intervals command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("Error: OPENAI_API_KEY or LANGCHAIN_API_KEY must be provided or set as environment variable")
        sys.exit(1)
    
    summarize_intervals(
        corpus_name=corpus_name,
        mongodb_uri=mongodb_uri,
        database_name=args.database,
        intervals_collection=args.intervals_collection,
        label_field=args.summary_label_field,
        start_chapter=args.summary_start_chapter,
        end_chapter=args.summary_end_chapter,
        max_intervals=args.summary_max_intervals,
        batch_size=args.summary_batch_size,
        force=args.summary_force,
        delay=args.summary_delay,
        api_key=api_key,
        model=args.model
    )


register_command('summarize_intervals', handle)

