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
    skip_existing: bool = True,
    provider: Optional[str] = None,
    model_name: Optional[str] = None
):
    """
    Generate embeddings for Apte dictionary entries and update MongoDB documents.
    
    Args:
        mongodb_uri: MongoDB connection URI
        database_name: Database name (default: apte_dictionary)
        collection_name: Collection name (default: entries)
        batch_size: Batch size for processing (default: 100)
        skip_existing: If True, skip documents that already have embeddings
        provider: Embedding provider ('huggingface' or 'openai', default: 'huggingface')
        model_name: Model identifier (default: 'sentence-transformers/all-MiniLM-L6-v2' for HuggingFace)
    """
    # Default to HuggingFace for local, no-cost embeddings
    if provider is None:
        provider = os.getenv('LANGCHAIN_EMBEDDING_PROVIDER', 'huggingface').lower()
    
    if model_name is None:
        if provider == 'huggingface':
            model_name = os.getenv('LANGCHAIN_EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2')
        else:
            model_name = os.getenv('LANGCHAIN_EMBEDDING_MODEL')
    
    # Connect to MongoDB
    print(f"Connecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    collection = db[collection_name]
    
    # Initialize embedding model
    print(f"Initializing embedding model: {provider}/{model_name}...")
    try:
        embedding_model = get_embedding_model(
            provider=provider,
            model_name=model_name,
            api_key=None  # HuggingFace doesn't need API key
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
    print(f"  Embedding model: {provider}/{model_name}")
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
    
    generate_apte_embeddings(
        mongodb_uri=mongodb_uri,
        database_name=database_name,
        collection_name=args.collection,
        batch_size=args.batch_size,
        skip_existing=not args.no_skip_existing,
        provider=args.provider,
        model_name=args.embedding_model
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
        '--no-skip-existing',
        action='store_true',
        help='Regenerate embeddings for existing documents'
    )
    subparser.add_argument(
        '--provider',
        help='Embedding provider (huggingface, openai). Default: huggingface'
    )
    subparser.add_argument(
        '--embedding-model',
        help='Embedding model name (default: sentence-transformers/all-MiniLM-L6-v2 for HuggingFace)'
    )


register_command('generate_apte_embeddings', handle, add_arguments, requires_corpus=False)

