"""Transliterate command handler."""

import os
import sys
import argparse

from config import get_corpus_config
from . import register_command
from .common_args import add_common_args, add_batch_size_arg


def handle(corpus_name: str, args):
    """Execute transliteration command."""
    corpus_name_lower = corpus_name.lower()
    
    # Special handling for Bhagavad Gita
    if corpus_name_lower == 'bhagavad_gita':
        from processor.transliterate_bhagavad_gita import transliterate_bhagavad_gita
        
        config = get_corpus_config(corpus_name)
        xml_path = args.xml_path or os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 'data', config['xml_file']
        )
        
        if not os.path.exists(xml_path):
            print(f"Error: XML file not found: {xml_path}")
            sys.exit(1)
        
        mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
        if not mongodb_uri:
            print("Error: MONGODB_URI must be provided or set as environment variable")
            sys.exit(1)
        
        database_name = args.database or 'bhagavad_gita_shankara_bhasya'
        
        transliterate_bhagavad_gita(
            xml_path=xml_path,
            mongodb_uri=mongodb_uri,
            database_name=database_name,
            batch_size=args.batch_size
        )
    elif corpus_name_lower == 'subhashita':
        # Special handling for Subhashita - use custom database and collection names
        from processor.transliterate_xml import transliterate_xml
        
        config = get_corpus_config(corpus_name)
        xml_path = args.xml_path or os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 'data', config['xml_file']
        )
        
        if not os.path.exists(xml_path):
            print(f"Error: XML file not found: {xml_path}")
            sys.exit(1)
        
        mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
        if not mongodb_uri:
            print("Error: MONGODB_URI must be provided or set as environment variable")
            sys.exit(1)
        
        # Use custom database and collection names for subhashita
        database_name = args.database or 'subhashita'
        collection_name = 'mahasubhasitasamgraha'
        
        transliterate_xml(
            xml_path=xml_path,
            verse_pattern=config['verse_pattern'],
            corpus_name=corpus_name,
            mongodb_uri=mongodb_uri,
            database_name=database_name,
            batch_size=args.batch_size,
            collection_name=collection_name
        )
    else:
        # Standard transliteration for other corpora
        from processor.transliterate_xml import transliterate_xml
        
        config = get_corpus_config(corpus_name)
        xml_path = args.xml_path or os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 'data', config['xml_file']
        )
        
        if not os.path.exists(xml_path):
            print(f"Error: XML file not found: {xml_path}")
            sys.exit(1)
        
        mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
        if not mongodb_uri:
            print("Error: MONGODB_URI must be provided or set as environment variable")
            sys.exit(1)
        
        transliterate_xml(
            xml_path=xml_path,
            verse_pattern=config['verse_pattern'],
            corpus_name=corpus_name,
            mongodb_uri=mongodb_uri,
            database_name=args.database,
            batch_size=args.batch_size
        )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for transliterate command."""
    add_common_args(subparser)
    subparser.add_argument(
        '--xml-path',
        help='Path to XML file (defaults to data/{corpus}.xml)'
    )
    add_batch_size_arg(subparser)


register_command('transliterate', handle, add_arguments, requires_corpus=True)

