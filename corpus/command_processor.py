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


def generate_embeddings_command(corpus_name: str, args):
    """Execute embedding generation command."""
    from processor.generate_embeddings import generate_embeddings_for_corpus
    
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("Error: LANGCHAIN_API_KEY or OPENAI_API_KEY must be provided or set as environment variable")
        sys.exit(1)
    
    generate_embeddings_for_corpus(
        corpus_name=corpus_name,
        mongodb_uri=mongodb_uri,
        database_name=args.database,
        vector_database=args.vector_database,
        vector_collection=args.vector_collection,
        batch_size=args.batch_size,
        skip_existing=not args.no_skip_existing,
        provider=args.provider,
        model_name=getattr(args, 'embedding_model', None),
        api_key=api_key
    )


def vector_search_command(args):
    """Execute vector search command."""
    from processor.search.vector_search import search_semantic
    
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    if not args.query:
        print("Error: Query string is required")
        sys.exit(1)
    
    api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
    
    embedding_model = getattr(args, 'embedding_model', None)
    results = search_semantic(
        query=args.query,
        mongodb_uri=mongodb_uri,
        database_name=args.database,
        collection_name=args.collection,
        corpus_filter=args.corpus,
        limit=args.limit,
        provider=args.provider,
        model_name=embedding_model,
        api_key=api_key
    )
    
    print(f"\nFound {len(results)} results:")
    print("=" * 80)
    for i, result in enumerate(results, 1):
        print(f"\n{i}. Score: {result.get('score', 0):.4f}")
        print(f"   Corpus: {result.get('corpus_name')}")
        verse_num = result.get('verse_number') or result.get('prose_number', 'N/A')
        print(f"   Verse/Prose: {verse_num}")
        print(f"   Chapter: {result.get('chapter_number')}")
        print(f"   Translation: {result.get('full_translation', '')[:200]}...")
        if result.get('original_iast'):
            print(f"   Sanskrit: {result.get('original_iast')[:100]}...")


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
        """
    )
    
    parser.add_argument(
        'command',
        choices=['transliterate', 'translate', 'import_to_mongo', 'generate_embeddings', 'vector_search', 'classify_verses', 'build_intervals', 'summarize_intervals', 'create_interval_theme_docs', 'generate_interval_theme_embeddings', 'cluster_interval_themes', 'generate_theme_nodes'],
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
        help='OpenAI model to use (default: gpt-4o). Options: gpt-4o, gpt-4-turbo, gpt-4, o1-preview, o1-mini'
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
    
    args = parser.parse_args()
    
    # Validate corpus name (not required for vector_search, generate_interval_theme_embeddings, cluster_interval_themes, or generate_theme_nodes)
    if args.command not in ['vector_search', 'generate_interval_theme_embeddings', 'cluster_interval_themes', 'generate_theme_nodes']:
        if not args.corpus:
            print("Error: Corpus name is required for this command")
            sys.exit(1)
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
        elif args.command == 'generate_embeddings':
            generate_embeddings_command(args.corpus, args)
        elif args.command == 'vector_search':
            vector_search_command(args)
        elif args.command == 'classify_verses':
            from processor.classify_verses import classify_verses
            
            mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
            if not mongodb_uri:
                print("Error: MONGODB_URI must be provided or set as environment variable")
                sys.exit(1)
            
            api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
            if not api_key:
                print("Error: OPENAI_API_KEY or LANGCHAIN_API_KEY must be provided or set as environment variable")
                sys.exit(1)
            
            classify_verses(
                corpus_name=args.corpus,
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
        elif args.command == 'build_intervals':
            from processor.build_intervals import build_intervals
            
            mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
            if not mongodb_uri:
                print("Error: MONGODB_URI must be provided or set as environment variable")
                sys.exit(1)
            
            build_intervals(
                corpus_name=args.corpus,
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
        elif args.command == 'summarize_intervals':
            from processor.summarize_intervals import summarize_intervals
            
            mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
            if not mongodb_uri:
                print("Error: MONGODB_URI must be provided or set as environment variable")
                sys.exit(1)
            
            api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
            if not api_key:
                print("Error: OPENAI_API_KEY or LANGCHAIN_API_KEY must be provided or set as environment variable")
                sys.exit(1)
            
            summarize_intervals(
                corpus_name=args.corpus,
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
        elif args.command == 'create_interval_theme_docs':
            from processor.create_interval_theme_docs import create_interval_theme_docs
            
            mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
            if not mongodb_uri:
                print("Error: MONGODB_URI must be provided or set as environment variable")
                sys.exit(1)
            
            create_interval_theme_docs(
                corpus_name=args.corpus,
                mongodb_uri=mongodb_uri,
                database_name=args.database,
                intervals_collection=args.intervals_collection,
                require_summarized=args.require_summarized,
                batch_size=args.batch_size
            )
        elif args.command == 'generate_interval_theme_embeddings':
            from processor.generate_interval_theme_embeddings import generate_interval_theme_embeddings
            
            mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
            if not mongodb_uri:
                print("Error: MONGODB_URI must be provided or set as environment variable")
                sys.exit(1)
            
            # Use corpus name if provided, otherwise default to pancatantra
            corpus_name = args.corpus or "pancatantra"
            database_name = args.database or corpus_name
            collection_name = f"{corpus_name}_interval_theme_docs"
            
            api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
            
            generate_interval_theme_embeddings(
                mongodb_uri=mongodb_uri,
                database_name=database_name,
                collection_name=collection_name,
                batch_size=args.batch_size,
                api_key=api_key
            )
        elif args.command == 'cluster_interval_themes':
            from processor.cluster_interval_themes import cluster_interval_themes
            
            mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
            if not mongodb_uri:
                print("Error: MONGODB_URI must be provided or set as environment variable")
                sys.exit(1)
            
            # Use corpus name if provided, otherwise default to pancatantra
            corpus_name = args.corpus or "pancatantra"
            database_name = args.database or corpus_name
            source_collection = args.source_collection or f"{corpus_name}_interval_theme_docs"
            target_collection = args.target_collection or f"{corpus_name}_theme_clusters"
            
            cluster_interval_themes(
                mongodb_uri=mongodb_uri,
                database_name=database_name,
                source_collection=source_collection,
                target_collection=target_collection,
                min_cluster_size=args.min_cluster_size,
                min_samples=args.min_samples
            )
        elif args.command == 'generate_theme_nodes':
            from processor.generate_theme_nodes import generate_theme_nodes
            
            mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
            if not mongodb_uri:
                print("Error: MONGODB_URI must be provided or set as environment variable")
                sys.exit(1)
            
            # Use corpus name if provided, otherwise default to pancatantra
            corpus_name = args.corpus or "pancatantra"
            database_name = args.database or corpus_name
            
            api_key = args.api_key or os.getenv('LANGCHAIN_API_KEY') or os.getenv('OPENAI_API_KEY')
            if not api_key:
                print("Error: OPENAI_API_KEY or LANGCHAIN_API_KEY must be provided or set as environment variable")
                sys.exit(1)
            
            generate_theme_nodes(
                mongodb_uri=mongodb_uri,
                database_name=database_name,
                clusters_collection=args.clusters_collection or f"{corpus_name}_theme_clusters",
                intervals_collection=f"{corpus_name}_interval_theme_docs",
                target_collection=args.theme_nodes_collection or f"{corpus_name}_theme_nodes",
                api_key=api_key,
                model=args.model,
                delay=args.theme_nodes_delay,
                force=args.theme_nodes_force
            )
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

