"""Classify Bhagavad Gita themes command handler."""

import os
import sys
import argparse

from processor.classify_bhagavad_gita_themes import classify_bhagavad_gita_themes
from . import register_command
from .common_args import add_common_args, add_api_key_arg, add_model_arg


def handle(corpus_name: str, args):
    """Execute classify_bhagavad_gita_themes command."""
    corpus_name_lower = corpus_name.lower()
    if corpus_name_lower != 'bhagavad_gita':
        print("Error: classify_bhagavad_gita_themes command only works with bhagavad_gita corpus")
        sys.exit(1)
    
    # Get MongoDB URI
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    # Get database name (defaults to bhagavad_gita_shankara_bhasya)
    database_name = args.database or 'bhagavad_gita_shankara_bhasya'
    
    # Get chapter range
    start_chapter = getattr(args, 'theme_start_chapter', None)
    end_chapter = getattr(args, 'theme_end_chapter', None)
    
    # Get API key
    api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("Error: OPENAI_API_KEY or LANGCHAIN_API_KEY must be provided or set as environment variable")
        sys.exit(1)
    
    # Get model
    model = args.model or 'gpt-5.1'
    
    # Get delay
    delay = getattr(args, 'theme_delay', 1.0)
    
    # Get force flag
    force = getattr(args, 'theme_force', False)
    
    classify_bhagavad_gita_themes(
        mongodb_uri=mongodb_uri,
        database_name=database_name,
        start_chapter=start_chapter,
        end_chapter=end_chapter,
        api_key=api_key,
        model=model,
        delay=delay,
        force=force
    )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for classify_bhagavad_gita_themes command."""
    add_common_args(subparser)
    add_api_key_arg(subparser)
    add_model_arg(subparser, default='gpt-5.1')
    subparser.add_argument(
        '--theme-start-chapter',
        type=int,
        help='First chapter to process (inclusive)'
    )
    subparser.add_argument(
        '--theme-end-chapter',
        type=int,
        help='Last chapter to process (inclusive)'
    )
    subparser.add_argument(
        '--theme-delay',
        type=float,
        default=1.0,
        help='Delay between API calls (seconds, default: 1.0)'
    )
    subparser.add_argument(
        '--theme-force',
        action='store_true',
        help='Overwrite existing theme classifications'
    )


register_command('classify_bhagavad_gita_themes', handle, add_arguments, requires_corpus=True, corpus_specific='bhagavad_gita')

