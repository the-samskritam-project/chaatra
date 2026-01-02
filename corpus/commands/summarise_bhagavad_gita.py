"""Summarise Bhagavad Gita command handler."""

import os
import sys
import argparse

from processor.summarise_bhagavad_gita import summarise_bhagavad_gita
from . import register_command
from .common_args import add_common_args


def handle(args):
    """Execute summarise_bhagavad_gita command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    summarise_bhagavad_gita(
        mongodb_uri=mongodb_uri,
        database_name=args.database or 'bhagavad_gita_shankara_bhasya',
        clear_existing=args.clear_existing
    )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for summarise_bhagavad_gita command."""
    add_common_args(subparser)
    subparser.add_argument(
        '--clear-existing',
        action='store_true',
        help='Clear existing summaries before generating new ones'
    )


register_command('summarise_bhagavad_gita', handle, add_arguments, requires_corpus=False)

