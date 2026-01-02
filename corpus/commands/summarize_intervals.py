"""Summarize intervals command handler."""

import os
import sys
import argparse

from processor.summarize_intervals import summarize_intervals
from . import register_command
from .common_args import add_common_args, add_api_key_arg, add_model_arg


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


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for summarize_intervals command."""
    add_common_args(subparser)
    add_api_key_arg(subparser)
    add_model_arg(subparser)
    subparser.add_argument(
        '--intervals-collection',
        help='Collection containing intervals (default: {corpus}_intervals)'
    )
    subparser.add_argument(
        '--summary-label-field',
        default='narrative_label',
        help='Label field used for context (default: narrative_label)'
    )
    subparser.add_argument(
        '--summary-start-chapter',
        type=int,
        help='First chapter number to summarize (inclusive)'
    )
    subparser.add_argument(
        '--summary-end-chapter',
        type=int,
        help='Last chapter number to summarize (inclusive)'
    )
    subparser.add_argument(
        '--summary-max-intervals',
        type=int,
        help='Max intervals to summarize'
    )
    subparser.add_argument(
        '--summary-batch-size',
        type=int,
        default=5,
        help='How many intervals per API batch (default: 5)'
    )
    subparser.add_argument(
        '--summary-force',
        action='store_true',
        help='Overwrite existing summaries/themes'
    )
    subparser.add_argument(
        '--summary-delay',
        type=float,
        default=0.0,
        help='Delay between API calls (seconds)'
    )


register_command('summarize_intervals', handle, add_arguments, requires_corpus=True)

