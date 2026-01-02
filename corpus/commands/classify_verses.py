"""Classify verses command handler."""

import os
import sys
import argparse

from processor.classify_verses import classify_verses
from . import register_command
from .common_args import add_common_args, add_api_key_arg, add_model_arg


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


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for classify_verses command."""
    add_common_args(subparser)
    add_api_key_arg(subparser)
    add_model_arg(subparser)
    subparser.add_argument(
        '--label-field',
        default='narrative_label',
        help='Document field name to store the label (default: narrative_label)'
    )
    subparser.add_argument(
        '--start-chapter',
        type=int,
        help='First chapter number to process (inclusive)'
    )
    subparser.add_argument(
        '--end-chapter',
        type=int,
        help='Last chapter number to process (inclusive)'
    )
    subparser.add_argument(
        '--max-per-chapter',
        type=int,
        help='Maximum number of verses to classify per chapter'
    )
    subparser.add_argument(
        '--force',
        action='store_true',
        help='Overwrite existing labels (default: skip labeled verses)'
    )


register_command('classify_verses', handle, add_arguments, requires_corpus=True)

