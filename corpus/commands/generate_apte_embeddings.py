"""Generate embeddings for Apte dictionary command handler."""

import os
import sys
import argparse
from datetime import datetime
from typing import List, Dict, Optional

try:
    from pymongo.errors import ConnectionFailure
except ImportError:
    print("Error: pymongo not installed. Install with: pip install pymongo")
    sys.exit(1)

from processor.utils.mongodb_utils import connect_mongodb
from processor.embeddings.langchain_embeddings import get_embedding_model
from . import register_command
from .common_args import add_batch_size_arg


def generate_apte_embeddings(
    mongodb_uri: str,
    database_name: str = "apte_dictionary",
    collection_name: str = "entries",
    batch_size: int = 100,
    skip_existing: bool = False,
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    dimensions: Optional[int] = None
):
    """
    Generate embeddings for Apte dictionary entries and update MongoDB documents.
    
    Args:
        mongodb_uri: MongoDB connection URI
        database_name: Database name (default: apte_dictionary)
        collection_name: Collection name (default: entries)
        batch_size: Batch size for processing (default: 100)
        skip_existing: If True, skip documents that already have embeddings (default: False - overwrite)
        provider: Embedding provider ('openai' or 'huggingface', default: 'openai')
        model_name: Model identifier (default: 'text-embedding-3-small' for OpenAI)
        api_key: API key for the provider (optional, uses env vars if not provided)
        dimensions: Number of dimensions for embeddings (default: 384 for OpenAI)
    """
    # Default to OpenAI for consistent embeddings
    if provider is None:
        provider = os.getenv('LANGCHAIN_EMBEDDING_PROVIDER', 'openai').lower()
    
    if model_name is None:
        if provider == 'openai':
            model_name = os.getenv('LANGCHAIN_EMBEDDING_MODEL', 'text-embedding-3-small')
        elif provider == 'huggingface':
            model_name = os.getenv('LANGCHAIN_EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2')
        else:
            model_name = os.getenv('LANGCHAIN_EMBEDDING_MODEL')
    
    # Default dimensions to 384 for OpenAI (balance of quality and storage efficiency)
    # Note: Cost is the same regardless of dimensions (based on input tokens only)
    if dimensions is None and provider == 'openai':
        dimensions = int(os.getenv('LANGCHAIN_EMBEDDING_DIMENSIONS', '384'))
    
    # Connect to MongoDB
    print(f"Connecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    collection = db[collection_name]
    
    # Initialize embedding model
    model_desc = f"{provider}/{model_name}"
    if dimensions:
        model_desc += f" (dimensions: {dimensions})"
    print(f"Initializing embedding model: {model_desc}...")
    try:
        embedding_model = get_embedding_model(
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            dimensions=dimensions if provider == 'openai' else None
        )
        print(f"✓ Embedding model initialized")
    except Exception as e:
        print(f"Error initializing embedding model: {e}")
        sys.exit(1)
    
    # Find documents to process
    if skip_existing:
        query = {"embedding": {"$exists": False}}
        print("Finding documents without embeddings...")
    else:
        query = {}
        print("Finding all documents (will regenerate embeddings)...")
    
    all_documents = list(collection.find(query))
    
    if not all_documents:
        print("No documents found to process")
        client.close()
        return
    
    print(f"✓ Found {len(all_documents)} documents to process")
    
    # Process in batches
    total_batches = (len(all_documents) + batch_size - 1) // batch_size
    total_processed = 0
    total_errors = 0
    
    print(f"\nProcessing {len(all_documents)} documents in {total_batches} batches...")
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(all_documents))
        batch = all_documents[start_idx:end_idx]
        
        print(f"\nBatch {batch_num + 1}/{total_batches} ({len(batch)} documents)...")
        
        # Extract meanings for embedding
        texts = []
        doc_ids = []
        valid_docs = []
        
        for doc in batch:
            meaning = doc.get('meaning', '')
            if meaning and meaning.strip():
                texts.append(meaning.strip())
                doc_ids.append(doc['_id'])
                valid_docs.append(doc)
            else:
                print(f"  ⚠ Skipping document {doc.get('_id')}: missing or empty meaning")
        
        if not texts:
            print(f"  No valid texts to embed in this batch")
            continue
        
        # Generate embeddings
        try:
            print(f"  Generating embeddings for {len(texts)} texts...")
            embeddings = embedding_model.embed_documents(texts)
            print(f"  ✓ Generated {len(embeddings)} embeddings")
        except Exception as e:
            print(f"  ✗ Error generating embeddings: {e}")
            total_errors += len(texts)
            continue
        
        # Update MongoDB documents
        updated_count = 0
        error_count = 0
        
        for i, doc_id in enumerate(doc_ids):
            try:
                collection.update_one(
                    {'_id': doc_id},
                    {
                        '$set': {
                            'embedding': embeddings[i],
                            'embedding_model': model_name,
                            'embedding_provider': provider,
                            'embedding_created_at': datetime.utcnow()
                        }
                    }
                )
                updated_count += 1
            except Exception as e:
                print(f"  ⚠ Error updating document {doc_id}: {e}")
                error_count += 1
        
        total_processed += updated_count
        total_errors += error_count
        
        print(f"  ✓ Updated {updated_count} documents, {error_count} errors")
    
    print(f"\n{'='*60}")
    print(f"Embedding Generation Summary:")
    print(f"  Total documents processed: {total_processed}")
    print(f"  Total errors: {total_errors}")
    model_info = f"{provider}/{model_name}"
    if dimensions:
        model_info += f" (dimensions: {dimensions})"
    print(f"  Embedding model: {model_info}")
    print(f"{'='*60}")
    
    client.close()
    print("\n✓ Embedding generation completed!")


def handle(args):
    """Execute generate Apte embeddings command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    database_name = args.database or "apte_dictionary"
    
    # Get API key from args or environment
    api_key = args.api_key or os.getenv('OPENAI_API_KEY') or os.getenv('LANGCHAIN_API_KEY')
    
    # Parse dimensions if provided
    dimensions = None
    if args.dimensions:
        try:
            dimensions = int(args.dimensions)
        except ValueError:
            print(f"Warning: Invalid dimensions value '{args.dimensions}', using default")
    
    # Default is False (overwrite existing), unless --skip-existing flag is set
    skip_existing = getattr(args, 'skip_existing', False)
    
    generate_apte_embeddings(
        mongodb_uri=mongodb_uri,
        database_name=database_name,
        collection_name=args.collection,
        batch_size=args.batch_size,
        skip_existing=skip_existing,
        provider=args.provider,
        model_name=args.embedding_model,
        api_key=api_key,
        dimensions=dimensions
    )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for generate_apte_embeddings command."""
    # Note: add_common_args is called automatically by command_processor.py
    add_batch_size_arg(subparser, default=100)
    subparser.add_argument(
        '--collection',
        default='entries',
        help='Collection name (default: entries)'
    )
    subparser.add_argument(
        '--skip-existing',
        action='store_true',
        help='Skip documents that already have embeddings (default: False - will overwrite existing)'
    )
    subparser.add_argument(
        '--provider',
        help='Embedding provider (openai, huggingface). Default: openai'
    )
    subparser.add_argument(
        '--embedding-model',
        help='Embedding model name (default: text-embedding-3-small for OpenAI)'
    )
    subparser.add_argument(
        '--api-key',
        help='API key for embedding provider (or set OPENAI_API_KEY env var)'
    )
    subparser.add_argument(
        '--dimensions',
        help='Number of dimensions for embeddings (default: 384 for OpenAI)'
    )


register_command('generate_apte_embeddings', handle, add_arguments, requires_corpus=False)

