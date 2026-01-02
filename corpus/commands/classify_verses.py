"""Classify verses command handler."""

import os
import sys

from processor.classify_verses import classify_verses
from . import register_command


def handle(corpus_name: str, args):
    """Execute classify_verses command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("Error: OPENAI_API_KEY or LANGCHAIN_API_KEY must be provided or set as environment variable")
        sys.exit(1)
    
    classify_verses(
        corpus_name=corpus_name,
        mongodb_uri=mongodb_uri,
        database_name=args.database,
        label_field=args.label_field,
        start_chapter=args.start_chapter,
        end_chapter=args.end_chapter,
        max_per_chapter=args.max_per_chapter,
        force=args.force,
        api_key=api_key,
        model=args.model
    )


register_command('classify_verses', handle)

