"""Translate command handler."""

import os
import sys

from processor.translate_verses import translate_verses
from . import register_command


def handle(corpus_name: str, args):
    """Execute translation command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    api_key = args.api_key or os.getenv('OPENAI_API_KEY')
    if not args.skip_translation and not api_key:
        print("Error: OPENAI_API_KEY must be provided or set as environment variable")
        print("Or use --skip-translation to skip translation and only update metadata")
        sys.exit(1)
    
    translate_verses(
        corpus_name=corpus_name,
        mongodb_uri=mongodb_uri,
        database_name=args.database,
        batch_size=args.batch_size,
        delay=args.delay,
        skip_translation=args.skip_translation,
        api_key=api_key,
        model=args.model
    )


register_command('translate', handle)

