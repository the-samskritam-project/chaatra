"""Build intervals command handler."""

import os
import sys
import argparse

from processor.build_intervals import build_intervals
from . import register_command
from .common_args import add_common_args


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


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for build_intervals command."""
    add_common_args(subparser)
    subparser.add_argument(
        '--output-collection',
        help='Target collection for intervals (default: {corpus}_intervals)'
    )
    subparser.add_argument(
        '--interval-label-field',
        default='narrative_label',
        help='Label field to split intervals on (default: narrative_label)'
    )
    subparser.add_argument(
        '--interval-start-chapter',
        type=int,
        help='First chapter number for interval building (inclusive)'
    )
    subparser.add_argument(
        '--interval-end-chapter',
        type=int,
        help='Last chapter number for interval building (inclusive)'
    )
    subparser.add_argument(
        '--interval-max-per-chapter',
        type=int,
        help='Max docs to read per chapter when building intervals'
    )
    subparser.add_argument(
        '--verses-only',
        action='store_true',
        help='When set, include only type=verse docs in intervals (default: include all)'
    )
    subparser.add_argument(
        '--keep-output',
        action='store_true',
        help='Do not drop the output interval collection before writing (default: drop first)'
    )


register_command('build_intervals', handle, add_arguments, requires_corpus=True)

