"""Translate subhashitas command handler."""

import os
import sys
import argparse

from processor.translate_subhashitas import translate_subhashitas
from . import register_command
from .common_args import add_common_args, add_api_key_arg, add_model_arg, add_delay_arg


def handle(args):
    """Execute translate_subhashitas command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    api_key = args.api_key or os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("Error: OPENAI_API_KEY must be provided or set as environment variable")
        sys.exit(1)
    
    translate_subhashitas(
        mongodb_uri=mongodb_uri,
        database_name=args.database or 'subhashita',
        collection_name=args.collection or 'mahasubhasitasamgraha',
        count=args.count,
        api_key=api_key,
        model=args.model,
        delay=args.delay,
        force=args.force,
        batch_size=getattr(args, 'batch_size', 20)
    )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for translate_subhashitas command."""
    add_common_args(subparser)
    add_api_key_arg(subparser)
    add_model_arg(subparser, default='gpt-5.2')
    add_delay_arg(subparser)
    
    # Set default for --database (added by add_common_args)
    # Check if it exists and update its default
    for action in subparser._actions:
        if '--database' in action.option_strings:
            action.default = 'subhashita'
            action.help = 'Database name (default: subhashita)'
            break
        
    subparser.add_argument(
        '--collection',
        default='mahasubhasitasamgraha',
        help='Collection name (default: mahasubhasitasamgraha)'
    )
    
    subparser.add_argument(
        '--count',
        type=int,
        default=1000,
        help='Number of random subhashitas to process (default: 1000)'
    )
    
    subparser.add_argument(
        '--force',
        action='store_true',
        help='Re-translate already-translated subhashitas'
    )
    
    subparser.add_argument(
        '--batch-size',
        type=int,
        default=20,
        help='Number of subhashitas to process concurrently (default: 20)'
    )


register_command('translate_subhashitas', handle, add_arguments, requires_corpus=False)

