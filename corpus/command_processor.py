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

from config import get_corpus_config
from commands import COMMAND_REGISTRY


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
  python command_processor.py transliterate bhagavad_gita --database bhagavad_gita_shankara_bhasya
  
  # Translate
  python command_processor.py translate hitopadesa
  python command_processor.py translate pancatantra --skip-translation
  
  # Import to MongoDB
  python command_processor.py import_to_mongo hitopadesa
  python command_processor.py import_to_mongo pancatantra --clear-existing
  
  # Generate embeddings
  python command_processor.py generate_embeddings hitopadesa
  python command_processor.py generate_embeddings pancatantra --batch-size 50
  
  # Vector search
  python command_processor.py vector_search --query "wisdom and knowledge" --limit 5
  python command_processor.py vector_search --query "moral lessons" --corpus hitopadesa
  
  # Classify verses
  python command_processor.py classify_verses pancatantra --start-chapter 1 --end-chapter 2

  # Build intervals (split on transitions)
  python command_processor.py build_intervals pancatantra --start-chapter 1 --end-chapter 2

  # Process Bhagavad Gita (splits and translations)
  python command_processor.py process_bhagavad_gita bhagavad_gita
  python command_processor.py process_bhagavad_gita bhagavad_gita --process-start-chapter 1 --process-end-chapter 5
  python command_processor.py process_bhagavad_gita bhagavad_gita --api-url http://localhost:8081 --process-delay 3.0
  
  # Extract chapters from XML to MongoDB
  python command_processor.py extract_chapters bhagavad_gita --extract-xml-path corpus/data/bhagavad_gita_ramanuja_bhashya.xml --extract-from-chapter 18 --extract-to-chapter 18
  python command_processor.py extract_chapters bhagavad_gita --extract-xml-path corpus/data/bhagavad_gita_ramanuja_bhashya.xml --extract-from-chapter 18 --extract-to-chapter 18 --extract-clear-existing
  
  # Extract Aditya Hridaya Stotra to MongoDB
  python command_processor.py extract_aditya_hridaya_stotra
  python command_processor.py extract_aditya_hridaya_stotra --stotra-json-path backend/chroma_db/valmiki_ramayan_shlokas.json --database aditya_hridaya_stotra
  
  # Summarise Bhagavad Gita chapters
  python command_processor.py summarise_bhagavad_gita
  python command_processor.py summarise_bhagavad_gita --clear-existing
  
  # Classify Bhagavad Gita verses into themes
  python command_processor.py classify_bhagavad_gita_themes bhagavad_gita
  python command_processor.py classify_bhagavad_gita_themes bhagavad_gita --theme-start-chapter 1 --theme-end-chapter 5
  python command_processor.py classify_bhagavad_gita_themes bhagavad_gita --theme-force
  
  # Generate embeddings for Bhagavad Gita
  python command_processor.py generate_bhagavad_gita_embeddings bhagavad_gita
  python command_processor.py generate_bhagavad_gita_embeddings bhagavad_gita --batch-size 50
  python command_processor.py generate_bhagavad_gita_embeddings bhagavad_gita --no-skip-existing
        """
    )
    
    parser.add_argument(
        'command',
        choices=['transliterate', 'translate', 'import_to_mongo', 'generate_embeddings', 'vector_search', 'classify_verses', 'build_intervals', 'summarize_intervals', 'create_interval_theme_docs', 'generate_interval_theme_embeddings', 'cluster_interval_themes', 'generate_theme_nodes', 'process_bhagavad_gita', 'extract_chapters', 'summarise_bhagavad_gita', 'classify_bhagavad_gita_themes', 'generate_bhagavad_gita_embeddings', 'extract_aditya_hridaya_stotra'],
        help='Command to execute'
    )
    parser.add_argument(
        'corpus',
        nargs='?',
        help='Corpus name (e.g., hitopadesa, pancatantra). Not required for vector_search command.'
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
        default='gpt-4o',
        help='OpenAI model to use (default: gpt-4o). Options: gpt-5.1, gpt-4o, gpt-4-turbo, gpt-4, o1-preview, o1-mini'
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
    
    # Embedding generation arguments
    parser.add_argument(
        '--vector-database',
        help='Database name for vector collection (defaults to corpus database)'
    )
    parser.add_argument(
        '--vector-collection',
        default='corpus_vector_search',
        help='Vector collection name (default: corpus_vector_search)'
    )
    parser.add_argument(
        '--no-skip-existing',
        action='store_true',
        help='Regenerate embeddings for existing documents'
    )
    parser.add_argument(
        '--provider',
        help='Embedding provider (openai, huggingface)'
    )
    parser.add_argument(
        '--embedding-model',
        help='Embedding model name (e.g., text-embedding-3-small)'
    )
    
    # Vector search arguments
    parser.add_argument(
        '--query',
        help='Search query string (required for vector_search command)'
    )
    parser.add_argument(
        '--collection',
        default='corpus_vector_search',
        help='Vector search collection name (default: corpus_vector_search)'
    )
    parser.add_argument(
        '--corpus',
        help='Filter results by corpus name (e.g., hitopadesa, pancatantra)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=10,
        help='Maximum number of search results (default: 10)'
    )
    
    # Classification arguments
    parser.add_argument(
        '--label-field',
        default='narrative_label',
        help='Document field name to store the label (default: narrative_label)'
    )
    parser.add_argument(
        '--start-chapter',
        type=int,
        help='First chapter number to process (inclusive)'
    )
    parser.add_argument(
        '--end-chapter',
        type=int,
        help='Last chapter number to process (inclusive)'
    )
    parser.add_argument(
        '--max-per-chapter',
        type=int,
        help='Maximum number of verses to classify per chapter'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Overwrite existing labels (default: skip labeled verses)'
    )

    # Interval building arguments
    parser.add_argument(
        '--output-collection',
        help='Target collection for intervals (default: {corpus}_intervals)'
    )
    parser.add_argument(
        '--interval-label-field',
        default='narrative_label',
        help='Label field to split intervals on (default: narrative_label)'
    )
    parser.add_argument(
        '--interval-start-chapter',
        type=int,
        help='First chapter number for interval building (inclusive)'
    )
    parser.add_argument(
        '--interval-end-chapter',
        type=int,
        help='Last chapter number for interval building (inclusive)'
    )
    parser.add_argument(
        '--interval-max-per-chapter',
        type=int,
        help='Max docs to read per chapter when building intervals'
    )
    parser.add_argument(
        '--verses-only',
        action='store_true',
        help='When set, include only type=verse docs in intervals (default: include all)'
    )
    parser.add_argument(
        '--keep-output',
        action='store_true',
        help='Do not drop the output interval collection before writing (default: drop first)'
    )

    # Interval summarization arguments
    parser.add_argument(
        '--intervals-collection',
        help='Collection containing intervals (default: {corpus}_intervals)'
    )
    parser.add_argument(
        '--summary-label-field',
        default='narrative_label',
        help='Label field used for context (default: narrative_label)'
    )
    parser.add_argument(
        '--summary-start-chapter',
        type=int,
        help='First chapter number to summarize (inclusive)'
    )
    parser.add_argument(
        '--summary-end-chapter',
        type=int,
        help='Last chapter number to summarize (inclusive)'
    )
    parser.add_argument(
        '--summary-max-intervals',
        type=int,
        help='Max intervals to summarize'
    )
    parser.add_argument(
        '--summary-batch-size',
        type=int,
        default=5,
        help='How many intervals per API batch (default: 5)'
    )
    parser.add_argument(
        '--summary-force',
        action='store_true',
        help='Overwrite existing summaries/themes'
    )
    parser.add_argument(
        '--summary-delay',
        type=float,
        default=0.0,
        help='Delay between API calls (seconds)'
    )

    # Interval theme docs creation arguments
    parser.add_argument(
        '--require-summarized',
        action='store_true',
        help='Skip intervals missing interval_summary or interval_themes'
    )

    # Interval theme clustering arguments
    parser.add_argument(
        '--source-collection',
        help='Source collection for clustering (default: {corpus}_interval_theme_docs)'
    )
    parser.add_argument(
        '--target-collection',
        help='Target collection for clusters (default: {corpus}_theme_clusters)'
    )
    parser.add_argument(
        '--min-cluster-size',
        type=int,
        default=5,
        help='Minimum cluster size for HDBSCAN (default: 5)'
    )
    parser.add_argument(
        '--min-samples',
        type=int,
        default=5,
        help='Minimum samples for HDBSCAN (default: 5)'
    )

    # Theme node generation arguments
    parser.add_argument(
        '--clusters-collection',
        help='Source clusters collection (default: {corpus}_theme_clusters)'
    )
    parser.add_argument(
        '--theme-nodes-collection',
        help='Target theme nodes collection (default: {corpus}_theme_nodes)'
    )
    # Process Bhagavad Gita arguments
    parser.add_argument(
        '--api-url',
        help='API base URL (default: http://localhost:8081, or API_BASE_URL env var)'
    )
    parser.add_argument(
        '--process-start-chapter',
        type=int,
        help='First chapter to process for process_bhagavad_gita (inclusive)'
    )
    parser.add_argument(
        '--process-end-chapter',
        type=int,
        help='Last chapter to process for process_bhagavad_gita (inclusive)'
    )
    parser.add_argument(
        '--process-delay',
        type=float,
        default=0.5,
        help='Delay between API calls in seconds for process_bhagavad_gita (default: 0.5)'
    )

    # Extract chapters arguments
    parser.add_argument(
        '--extract-xml-path',
        help='Path to source XML file for extract_chapters command'
    )
    parser.add_argument(
        '--extract-from-chapter',
        type=int,
        help='Starting chapter number for extract_chapters (inclusive)'
    )
    parser.add_argument(
        '--extract-to-chapter',
        type=int,
        help='Ending chapter number for extract_chapters (inclusive)'
    )
    parser.add_argument(
        '--extract-batch-size',
        type=int,
        default=50,
        help='Batch size for MongoDB writes in extract_chapters (default: 50)'
    )
    parser.add_argument(
        '--extract-clear-existing',
        action='store_true',
        help='Clear existing chapter data before importing in extract_chapters'
    )
    parser.add_argument(
        '--theme-nodes-delay',
        type=float,
        default=0.0,
        help='Delay between API calls for theme node generation (seconds, default: 0.0)'
    )
    parser.add_argument(
        '--theme-nodes-force',
        action='store_true',
        help='Overwrite existing theme nodes'
    )
    
    # Classify Bhagavad Gita themes arguments
    parser.add_argument(
        '--theme-start-chapter',
        type=int,
        help='First chapter to process for classify_bhagavad_gita_themes (inclusive)'
    )
    parser.add_argument(
        '--theme-end-chapter',
        type=int,
        help='Last chapter to process for classify_bhagavad_gita_themes (inclusive)'
    )
    parser.add_argument(
        '--theme-delay',
        type=float,
        default=1.0,
        help='Delay between API calls for classify_bhagavad_gita_themes (seconds, default: 1.0)'
    )
    parser.add_argument(
        '--theme-force',
        action='store_true',
        help='Overwrite existing theme classifications for classify_bhagavad_gita_themes'
    )
    
    # Generate Bhagavad Gita embeddings arguments
    parser.add_argument(
        '--bg-vector-collection',
        help='Vector collection name for generate_bhagavad_gita_embeddings (default: bhagavad_gita_vector_search)'
    )
    
    # Extract Aditya Hridaya Stotra arguments
    parser.add_argument(
        '--stotra-json-path',
        dest='stotra_json_path',
        help='Path to Ramayana JSON file for extract_aditya_hridaya_stotra (default: backend/chroma_db/valmiki_ramayan_shlokas.json)'
    )
    
    args = parser.parse_args()
    
    # Validate corpus name (not required for vector_search, generate_interval_theme_embeddings, cluster_interval_themes, generate_theme_nodes)
    # process_bhagavad_gita, extract_chapters, summarise_bhagavad_gita, classify_bhagavad_gita_themes, generate_bhagavad_gita_embeddings, and extract_aditya_hridaya_stotra require corpus but validation is done in the command function
    if args.command not in ['vector_search', 'generate_interval_theme_embeddings', 'cluster_interval_themes', 'generate_theme_nodes', 'process_bhagavad_gita', 'extract_chapters', 'summarise_bhagavad_gita', 'classify_bhagavad_gita_themes', 'generate_bhagavad_gita_embeddings', 'extract_aditya_hridaya_stotra']:
        if not args.corpus:
            print("Error: Corpus name is required for this command")
            sys.exit(1)
        try:
            get_corpus_config(args.corpus)
        except ValueError as e:
            print(f"Error: {e}")
            sys.exit(1)
    elif args.command == 'process_bhagavad_gita':
        # Validate corpus for process_bhagavad_gita
        if not args.corpus:
            print("Error: Corpus name is required for process_bhagavad_gita command")
            sys.exit(1)
        if args.corpus.lower() != 'bhagavad_gita':
            print("Error: process_bhagavad_gita command only works with bhagavad_gita corpus")
            sys.exit(1)
    elif args.command == 'extract_chapters':
        # Validate corpus for extract_chapters
        if not args.corpus:
            print("Error: Corpus name is required for extract_chapters command")
            sys.exit(1)
        if args.corpus.lower() != 'bhagavad_gita':
            print("Error: extract_chapters command only works with bhagavad_gita corpus")
            sys.exit(1)
    elif args.command == 'classify_bhagavad_gita_themes':
        # Validate corpus for classify_bhagavad_gita_themes
        if not args.corpus:
            print("Error: Corpus name is required for classify_bhagavad_gita_themes command")
            sys.exit(1)
        if args.corpus.lower() != 'bhagavad_gita':
            print("Error: classify_bhagavad_gita_themes command only works with bhagavad_gita corpus")
            sys.exit(1)
    elif args.command == 'generate_bhagavad_gita_embeddings':
        # Validate corpus for generate_bhagavad_gita_embeddings
        if not args.corpus:
            print("Error: Corpus name is required for generate_bhagavad_gita_embeddings command")
            sys.exit(1)
        if args.corpus.lower() != 'bhagavad_gita':
            print("Error: generate_bhagavad_gita_embeddings command only works with bhagavad_gita corpus")
            sys.exit(1)
    
    # Execute command
    try:
        handler = COMMAND_REGISTRY.get(args.command)
        if not handler:
            print(f"Error: Unknown command: {args.command}")
            sys.exit(1)
        
        # Commands that don't require corpus name
        corpus_agnostic_commands = [
            'vector_search',
            'generate_interval_theme_embeddings',
            'cluster_interval_themes',
            'generate_theme_nodes',
            'extract_aditya_hridaya_stotra',
            'summarise_bhagavad_gita'
        ]
        
        if args.command in corpus_agnostic_commands:
            handler(args)
        else:
            handler(args.corpus, args)
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

