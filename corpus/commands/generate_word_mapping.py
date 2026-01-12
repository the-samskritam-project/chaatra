"""Generate word mapping command handler."""

import os
import sys
import argparse

from processor.generate_word_mapping import generate_word_mappings
from . import register_command
from .common_args import add_common_args, add_api_key_arg, add_model_arg, add_delay_arg


def handle(corpus_name: str, args):
    """Execute generate_word_mapping command."""
    corpus_name_lower = corpus_name.lower()
    if corpus_name_lower != 'bhagavad_gita':
        print("Error: generate_word_mapping command only works with bhagavad_gita corpus")
        sys.exit(1)
    
    # Get MongoDB URI
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    # Get database name (defaults to bhagavad_gita_shankara_bhasya)
    database_name = args.database or 'bhagavad_gita_shankara_bhasya'
    
    # Get chapter range
    start_chapter = getattr(args, 'mapping_start_chapter', None)
    end_chapter = getattr(args, 'mapping_end_chapter', None)
    
    # Get API key
    api_key = args.api_key or os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("Error: OPENAI_API_KEY must be provided or set as environment variable")
        sys.exit(1)
    
    # Get model
    model = args.model or 'gpt-4o'
    
    # Get delay
    delay = getattr(args, 'delay', 1.0)
    
    # Get skip_existing flag
    skip_existing = getattr(args, 'mapping_skip_existing', False)
    
    # Get force flag (overrides skip_existing)
    force = getattr(args, 'mapping_force', False)
    
    # Get batch size
    batch_size = getattr(args, 'mapping_batch_size', 10)
    
    generate_word_mappings(
        mongodb_uri=mongodb_uri,
        database_name=database_name,
        api_key=api_key,
        model=model,
        start_chapter=start_chapter,
        end_chapter=end_chapter,
        skip_existing=skip_existing and not force,  # Skip only if not forcing
        delay=delay,
        batch_size=batch_size
    )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for generate_word_mapping command."""
    add_common_args(subparser)
    add_api_key_arg(subparser)
    add_model_arg(subparser, default='gpt-4o')
    add_delay_arg(subparser, default=1.0)
    subparser.add_argument(
        '--mapping-start-chapter',
        type=int,
        help='First chapter to process (inclusive)'
    )
    subparser.add_argument(
        '--mapping-end-chapter',
        type=int,
        help='Last chapter to process (inclusive)'
    )
    subparser.add_argument(
        '--mapping-skip-existing',
        action='store_true',
        help='Skip documents that already have word_to_split_mapping field'
    )
    subparser.add_argument(
        '--mapping-force',
        action='store_true',
        help='Force regeneration of mappings even if they already exist (overrides --mapping-skip-existing)'
    )
    subparser.add_argument(
        '--mapping-batch-size',
        type=int,
        default=10,
        help='Number of documents to process per batch (default: 10)'
    )


register_command('generate_word_mapping', handle, add_arguments, requires_corpus=True, corpus_specific='bhagavad_gita')
