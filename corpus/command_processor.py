#!/usr/bin/env python3
"""
Command processor for corpus processing.

Takes a command (transliterate, translate, or import_to_mongo) and a corpus name,
and executes the appropriate processing step.
"""

import os
import sys
import argparse

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

# Corpus configuration: maps corpus names to verse patterns
CORPUS_CONFIG = {
    'hitopadesa': {
        'verse_pattern': r'//\s*Hit_(\d+\.\d+)\s*//',
        'xml_file': 'hitopadesa.xml'
    },
    'pancatantra': {
        'verse_pattern': r'\|\|Panc_(\d+\.\d+)\|\|',
        'xml_file': 'pancatantra.xml'
    }
}


def get_corpus_config(corpus_name: str):
    """
    Get configuration for a corpus.
    
    Args:
        corpus_name: Name of the corpus
        
    Returns:
        Dictionary with verse_pattern and xml_file
        
    Raises:
        ValueError: If corpus name is not recognized
    """
    corpus_name_lower = corpus_name.lower()
    if corpus_name_lower not in CORPUS_CONFIG:
        available = ', '.join(CORPUS_CONFIG.keys())
        raise ValueError(
            f"Unknown corpus: {corpus_name}. Available: {available}"
        )
    return CORPUS_CONFIG[corpus_name_lower]


def transliterate_command(corpus_name: str, args):
    """Execute transliteration command."""
    from processor.transliterate_xml import transliterate_xml
    
    config = get_corpus_config(corpus_name)
    xml_path = args.xml_path or os.path.join(
        os.path.dirname(__file__), 'data', config['xml_file']
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


def translate_command(corpus_name: str, args):
    """Execute translation command."""
    from processor.translate_verses import translate_verses
    
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


def import_to_mongo_command(corpus_name: str, args):
    """Execute import to MongoDB command."""
    from processor.import_to_mongodb import import_to_mongodb
    
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    import_to_mongodb(
        corpus_name=corpus_name,
        mongodb_uri=mongodb_uri,
        database_name=args.database,
        clear_existing=args.clear_existing
    )


def main():
    """Main CLI entry point."""
    # Load environment variables
    if load_dotenv:
        env_path = os.path.join(os.path.dirname(__file__), '.env')
        if os.path.exists(env_path):
            load_dotenv(dotenv_path=env_path)
    
    parser = argparse.ArgumentParser(
        description='Process corpus files (transliterate, translate, import to MongoDB)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Transliterate
  python command_processor.py transliterate hitopadesa
  python command_processor.py transliterate pancatantra
  
  # Translate
  python command_processor.py translate hitopadesa
  python command_processor.py translate pancatantra --skip-translation
  
  # Import to MongoDB
  python command_processor.py import_to_mongo hitopadesa
  python command_processor.py import_to_mongo pancatantra --clear-existing
        """
    )
    
    parser.add_argument(
        'command',
        choices=['transliterate', 'translate', 'import_to_mongo'],
        help='Command to execute'
    )
    parser.add_argument(
        'corpus',
        help='Corpus name (e.g., hitopadesa, pancatantra)'
    )
    
    # Common arguments
    parser.add_argument(
        '--mongodb-uri',
        help='MongoDB connection URI (or set MONGODB_URI env var)'
    )
    parser.add_argument(
        '--database',
        help='Database name (defaults to corpus name)'
    )
    
    # Transliterate-specific arguments
    parser.add_argument(
        '--xml-path',
        help='Path to XML file (defaults to data/{corpus}.xml)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=10,
        help='Batch size for processing (default: 10)'
    )
    
    # Translate-specific arguments
    parser.add_argument(
        '--api-key',
        help='OpenAI API key (or set OPENAI_API_KEY env var)'
    )
    parser.add_argument(
        '--model',
        default='gpt-5',
        help='OpenAI model to use (default: gpt-5)'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=1.0,
        help='Delay between API calls in seconds (default: 1.0)'
    )
    parser.add_argument(
        '--skip-translation',
        action='store_true',
        help='Skip translation and only update metadata'
    )
    
    # Import-specific arguments
    parser.add_argument(
        '--clear-existing',
        action='store_true',
        help='Clear existing collections before importing'
    )
    
    args = parser.parse_args()
    
    # Validate corpus name
    try:
        get_corpus_config(args.corpus)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Execute command
    try:
        if args.command == 'transliterate':
            transliterate_command(args.corpus, args)
        elif args.command == 'translate':
            translate_command(args.corpus, args)
        elif args.command == 'import_to_mongo':
            import_to_mongo_command(args.corpus, args)
    except KeyboardInterrupt:
        print("\n\n⚠ Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

