#!/usr/bin/env python3
"""
Generate embeddings for corpus translations and store in vector search collection.

Reads from existing chapter collections and generates embeddings for English
translations, storing them in a unified vector search collection.
"""

import os
import sys
import re
from typing import Dict, List, Optional
from datetime import datetime

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

try:
    from pymongo.errors import ConnectionFailure, DuplicateKeyError
except ImportError:
    print("Error: pymongo not installed. Install with: pip install pymongo")
    sys.exit(1)

from processor.utils.mongodb_utils import connect_mongodb
from processor.embeddings.langchain_embeddings import (
    get_embedding_model,
    generate_embeddings_batch
)


def get_all_chapter_collections(db, corpus_name: str) -> List[str]:
    """
    Get all chapter collection names for a corpus.
    
    Args:
        db: MongoDB database object
        corpus_name: Corpus name (e.g., 'hitopadesa', 'pancatantra')
    
    Returns:
        List of collection names
    """
    collections = db.list_collection_names()
    chapter_collections = [
        name for name in collections
        if name.startswith(f"{corpus_name}_chapter_")
    ]
    return sorted(chapter_collections, key=lambda x: int(x.split('_')[-1]))


def extract_documents_for_embedding(
    db,
    corpus_name: str,
    batch_size: int = 100
) -> List[Dict]:
    """
    Extract all documents with translations from chapter collections.
    
    Args:
        db: MongoDB database object
        corpus_name: Corpus name
        batch_size: Batch size for processing
    
    Returns:
        List of documents ready for embedding
    """
    documents = []
    chapter_collections = get_all_chapter_collections(db, corpus_name)
    
    print(f"Found {len(chapter_collections)} chapter collections for {corpus_name}")
    
    for collection_name in chapter_collections:
        collection = db[collection_name]
        
        # Find all documents with full_translation
        items = list(collection.find({
            "full_translation": {"$exists": True, "$ne": ""}
        }))
        
        for item in items:
            doc = {
                "document_id": item.get("_id"),
                "corpus_name": corpus_name,
                "chapter_number": item.get("chapter_number"),
                "verse_number": item.get("verse_number"),
                "prose_number": item.get("prose_number"),
                "type": item.get("type"),
                "full_translation": item.get("full_translation"),
                "original_iast": item.get("original_iast", ""),
                "transliterated_devanagari": item.get("transliterated_devanagari", ""),
                "chapter_sequence_index": item.get("chapter_sequence_index", 0),
                "metadata": {
                    "verse_index": item.get("verse_index"),
                    "prose_index": item.get("prose_index"),
                    "sequence_index": item.get("sequence_index")
                }
            }
            documents.append(doc)
    
    print(f"Extracted {len(documents)} documents with translations")
    return documents


def generate_embeddings_for_corpus(
    corpus_name: str,
    mongodb_uri: str,
    database_name: Optional[str] = None,
    vector_database: Optional[str] = None,
    vector_collection: str = "corpus_vector_search",
    batch_size: int = 100,
    skip_existing: bool = True,
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None
):
    """
    Generate embeddings for a corpus and store in vector search collection.
    
    Args:
        corpus_name: Corpus name (e.g., 'hitopadesa', 'pancatantra')
        mongodb_uri: MongoDB connection URI
        database_name: Database name for corpus (defaults to corpus_name)
        vector_database: Database name for vector search collection (defaults to database_name)
        vector_collection: Collection name for vector search (default: corpus_vector_search)
        batch_size: Batch size for embedding generation (default: 100)
        skip_existing: Skip documents that already have embeddings (default: True)
        provider: Embedding provider (optional, uses env vars if not provided)
        model_name: Model identifier (optional, uses env vars if not provided)
        api_key: API key (optional, uses env vars if not provided)
    """
    if database_name is None:
        database_name = corpus_name
    
    if vector_database is None:
        vector_database = database_name
    
    print(f"\n{'='*60}")
    print(f"Generating embeddings for {corpus_name}")
    print(f"{'='*60}")
    print(f"Corpus database: {database_name}")
    print(f"Vector database: {vector_database}")
    print(f"Vector collection: {vector_collection}")
    print(f"Batch size: {batch_size}")
    print(f"Skip existing: {skip_existing}")
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
        vector_db = client[vector_database]
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Get embedding model
    print(f"\nInitializing embedding model...")
    try:
        embedding_model = get_embedding_model(provider=provider, model_name=model_name, api_key=api_key)
        print(f"✓ Using embedding model: {model_name or os.getenv('LANGCHAIN_EMBEDDING_MODEL', 'default')}")
    except Exception as e:
        print(f"Error initializing embedding model: {e}")
        sys.exit(1)
    
    # Extract documents
    print(f"\nExtracting documents from {corpus_name}...")
    documents = extract_documents_for_embedding(db, corpus_name, batch_size)
    
    if not documents:
        print(f"No documents found with translations in {corpus_name}")
        return
    
    # Get vector search collection
    vector_collection_obj = vector_db[vector_collection]
    
    # Check existing embeddings if skip_existing is True
    existing_ids = set()
    if skip_existing:
        print(f"\nChecking for existing embeddings...")
        existing_docs = vector_collection_obj.find(
            {"corpus_name": corpus_name},
            {"document_id": 1}
        )
        existing_ids = {doc["document_id"] for doc in existing_docs}
        print(f"Found {len(existing_ids)} existing embeddings")
    
    # Filter out existing documents
    documents_to_process = [
        doc for doc in documents
        if doc["document_id"] not in existing_ids
    ]
    
    if not documents_to_process:
        print(f"\nAll documents already have embeddings. Use --no-skip-existing to regenerate.")
        return
    
    print(f"\nProcessing {len(documents_to_process)} documents...")
    
    # Process in batches
    total_batches = (len(documents_to_process) + batch_size - 1) // batch_size
    total_inserted = 0
    total_errors = 0
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(documents_to_process))
        batch = documents_to_process[start_idx:end_idx]
        
        print(f"\nBatch {batch_num + 1}/{total_batches} ({len(batch)} documents)...")
        
        # Extract texts for embedding
        texts = [doc["full_translation"] for doc in batch]
        
        # Generate embeddings
        try:
            print(f"  Generating embeddings...")
            embeddings = embedding_model.embed_documents(texts)
            print(f"  ✓ Generated {len(embeddings)} embeddings")
        except Exception as e:
            print(f"  ✗ Error generating embeddings: {e}")
            total_errors += len(batch)
            continue
        
        # Prepare documents for insertion
        vector_docs = []
        for i, doc in enumerate(batch):
            vector_doc = {
                "_id": f"{corpus_name}_{doc['document_id']}",  # Unique ID combining corpus and document
                "corpus_name": corpus_name,
                "document_id": doc["document_id"],
                "chapter_number": doc["chapter_number"],
                "verse_number": doc.get("verse_number"),
                "prose_number": doc.get("prose_number"),
                "type": doc.get("type"),
                "embedding": embeddings[i],
                "full_translation": doc["full_translation"],
                "original_iast": doc["original_iast"],
                "transliterated_devanagari": doc.get("transliterated_devanagari", ""),
                "metadata": doc["metadata"],
                "created_at": datetime.utcnow()
            }
            vector_docs.append(vector_doc)
        
        # Insert into vector search collection
        try:
            result = vector_collection_obj.insert_many(vector_docs, ordered=False)
            inserted = len(result.inserted_ids)
            total_inserted += inserted
            print(f"  ✓ Inserted {inserted} embeddings")
        except DuplicateKeyError:
            # Some documents might have been inserted by another process
            inserted = 0
            for vector_doc in vector_docs:
                try:
                    vector_collection_obj.insert_one(vector_doc)
                    inserted += 1
                    total_inserted += 1
                except DuplicateKeyError:
                    pass
            print(f"  ✓ Inserted {inserted} embeddings (some duplicates skipped)")
        except Exception as e:
            print(f"  ✗ Error inserting embeddings: {e}")
            total_errors += len(batch)
    
    print(f"\n{'='*60}")
    print(f"Embedding Generation Summary:")
    print(f"  Total documents processed: {len(documents_to_process)}")
    print(f"  Successfully inserted: {total_inserted}")
    print(f"  Errors: {total_errors}")
    print(f"{'='*60}")
    
    client.close()
    print("\n✓ Embedding generation completed!")


def discover_bhagavad_gita_chapter_collections(db) -> List[int]:
    """
    Discover all chapter collections matching pattern chapter_\d+ for Bhagavad Gita.
    
    Args:
        db: MongoDB database object
        
    Returns:
        List of chapter numbers (integers)
    """
    collections = db.list_collection_names()
    chapter_numbers = []
    
    for coll_name in collections:
        match = re.match(r'^chapter_(\d+)$', coll_name)
        if match:
            chapter_num = int(match.group(1))
            chapter_numbers.append(chapter_num)
    
    return sorted(chapter_numbers)


def combine_bhagavad_gita_text(doc: Dict) -> Optional[str]:
    """
    Combine full_translation, primary_theme, and rationale fields for embedding.
    
    Args:
        doc: MongoDB document
        
    Returns:
        Combined text string, or None if full_translation is missing
    """
    full_translation = doc.get("full_translation", "").strip()
    if not full_translation:
        return None
    
    parts = [full_translation]
    
    primary_theme = doc.get("primary_theme", "").strip()
    if primary_theme:
        parts.append(f"\n\nTheme: {primary_theme}")
    
    rationale = doc.get("rationale", "").strip()
    if rationale:
        parts.append(f"\n\nRationale: {rationale}")
    
    return "".join(parts)


def generate_bhagavad_gita_embeddings(
    mongodb_uri: str,
    database_name: str = 'bhagavad_gita_shankara_bhasya',
    vector_collection: str = "bhagavad_gita_vector_search",
    batch_size: int = 100,
    skip_existing: bool = True,
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None
):
    """
    Generate embeddings for Bhagavad Gita verses and store in vector search collection.
    
    Combines full_translation + primary_theme + rationale fields for embedding.
    Iterates over all documents in all chapter collections.
    
    Args:
        mongodb_uri: MongoDB connection URI
        database_name: Database name (defaults to bhagavad_gita_shankara_bhasya)
        vector_collection: Collection name for vector search (default: bhagavad_gita_vector_search)
        batch_size: Batch size for embedding generation (default: 100)
        skip_existing: Skip documents that already have embeddings (default: True)
        provider: Embedding provider (optional, uses env vars if not provided)
        model_name: Model identifier (optional, uses env vars if not provided)
        api_key: API key (optional, uses env vars if not provided)
    """
    print(f"\n{'='*60}")
    print(f"Generating embeddings for Bhagavad Gita")
    print(f"{'='*60}")
    print(f"Database: {database_name}")
    print(f"Vector collection: {vector_collection}")
    print(f"Batch size: {batch_size}")
    print(f"Skip existing: {skip_existing}")
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Get embedding model
    print(f"\nInitializing embedding model...")
    try:
        embedding_model = get_embedding_model(provider=provider, model_name=model_name, api_key=api_key)
        print(f"✓ Using embedding model: {model_name or os.getenv('LANGCHAIN_EMBEDDING_MODEL', 'default')}")
    except Exception as e:
        print(f"Error initializing embedding model: {e}")
        client.close()
        sys.exit(1)
    
    # Discover chapter collections
    print(f"\nDiscovering chapter collections...")
    chapter_numbers = discover_bhagavad_gita_chapter_collections(db)
    
    if not chapter_numbers:
        print("Error: No chapter collections found (expected pattern: chapter_N)")
        client.close()
        sys.exit(1)
    
    print(f"✓ Found {len(chapter_numbers)} chapter collections")
    
    # Extract all documents from all chapter collections
    print(f"\nExtracting documents from all chapter collections...")
    documents = []
    skipped_no_translation = 0
    
    for chapter_num in chapter_numbers:
        collection_name = f"chapter_{chapter_num}"
        collection = db[collection_name]
        
        # Get all documents (not filtering by full_translation yet, we'll check in combine function)
        items = list(collection.find({}))
        
        for item in items:
            # Combine text fields
            combined_text = combine_bhagavad_gita_text(item)
            if combined_text is None:
                skipped_no_translation += 1
                continue
            
            doc = {
                "document_id": item.get("_id"),
                "corpus_name": "bhagavad_gita",
                "chapter_number": item.get("chapter_number", chapter_num),
                "verse_number": item.get("verse_number"),
                "prose_number": item.get("prose_number"),
                "type": item.get("type"),
                "full_translation": item.get("full_translation", ""),
                "original_iast": item.get("original_iast", ""),
                "transliterated_devanagari": item.get("transliterated_devanagari", ""),
                "primary_theme": item.get("primary_theme", ""),
                "rationale": item.get("rationale", ""),
                "combined_text": combined_text,
                "metadata": {
                    "verse_index": item.get("verse_index"),
                    "prose_index": item.get("prose_index"),
                    "sequence_index": item.get("sequence_index"),
                    "sequence_number": item.get("sequence_number"),
                }
            }
            documents.append(doc)
    
    print(f"Extracted {len(documents)} documents with translations")
    if skipped_no_translation > 0:
        print(f"Skipped {skipped_no_translation} documents without full_translation")
    
    if not documents:
        print(f"No documents found with translations")
        client.close()
        return
    
    # Get vector search collection (same database)
    vector_collection_obj = db[vector_collection]
    
    # Check existing embeddings if skip_existing is True
    existing_ids = set()
    if skip_existing:
        print(f"\nChecking for existing embeddings...")
        existing_docs = vector_collection_obj.find(
            {"corpus_name": "bhagavad_gita"},
            {"document_id": 1}
        )
        existing_ids = {doc["document_id"] for doc in existing_docs}
        print(f"Found {len(existing_ids)} existing embeddings")
    
    # Filter out existing documents
    documents_to_process = [
        doc for doc in documents
        if doc["document_id"] not in existing_ids
    ]
    
    if not documents_to_process:
        print(f"\nAll documents already have embeddings. Use --no-skip-existing to regenerate.")
        client.close()
        return
    
    print(f"\nProcessing {len(documents_to_process)} documents...")
    
    # Process in batches
    total_batches = (len(documents_to_process) + batch_size - 1) // batch_size
    total_inserted = 0
    total_errors = 0
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(documents_to_process))
        batch = documents_to_process[start_idx:end_idx]
        
        print(f"\nBatch {batch_num + 1}/{total_batches} ({len(batch)} documents)...")
        
        # Extract combined texts for embedding
        texts = [doc["combined_text"] for doc in batch]
        
        # Generate embeddings
        try:
            print(f"  Generating embeddings...")
            embeddings = embedding_model.embed_documents(texts)
            print(f"  ✓ Generated {len(embeddings)} embeddings")
        except Exception as e:
            print(f"  ✗ Error generating embeddings: {e}")
            total_errors += len(batch)
            continue
        
        # Prepare documents for insertion
        vector_docs = []
        for i, doc in enumerate(batch):
            vector_doc = {
                "_id": f"bhagavad_gita_{doc['document_id']}",  # Unique ID combining corpus and document
                "corpus_name": "bhagavad_gita",
                "document_id": doc["document_id"],
                "chapter_number": doc["chapter_number"],
                "verse_number": doc.get("verse_number"),
                "prose_number": doc.get("prose_number"),
                "type": doc.get("type"),
                "embedding": embeddings[i],
                "full_translation": doc["full_translation"],
                "original_iast": doc["original_iast"],
                "transliterated_devanagari": doc.get("transliterated_devanagari", ""),
                "primary_theme": doc.get("primary_theme", ""),
                "rationale": doc.get("rationale", ""),
                "metadata": doc["metadata"],
                "created_at": datetime.utcnow()
            }
            vector_docs.append(vector_doc)
        
        # Insert into vector search collection
        try:
            result = vector_collection_obj.insert_many(vector_docs, ordered=False)
            inserted = len(result.inserted_ids)
            total_inserted += inserted
            print(f"  ✓ Inserted {inserted} embeddings")
        except DuplicateKeyError:
            # Some documents might have been inserted by another process
            inserted = 0
            for vector_doc in vector_docs:
                try:
                    vector_collection_obj.insert_one(vector_doc)
                    inserted += 1
                    total_inserted += 1
                except DuplicateKeyError:
                    pass
            print(f"  ✓ Inserted {inserted} embeddings (some duplicates skipped)")
        except Exception as e:
            print(f"  ✗ Error inserting embeddings: {e}")
            total_errors += len(batch)
    
    print(f"\n{'='*60}")
    print(f"Embedding Generation Summary:")
    print(f"  Total documents processed: {len(documents_to_process)}")
    print(f"  Successfully inserted: {total_inserted}")
    print(f"  Errors: {total_errors}")
    print(f"{'='*60}")
    
    client.close()
    print("\n✓ Embedding generation completed!")


if __name__ == '__main__':
    # This script is typically called from command_processor.py
    # But can be used standalone with proper arguments
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate embeddings for corpus translations')
    parser.add_argument('corpus_name', help='Name of the corpus')
    parser.add_argument('--mongodb-uri', help='MongoDB connection URI', 
                       default=os.getenv('MONGODB_URI'))
    parser.add_argument('--database', help='Database name (defaults to corpus name)', default=None)
    parser.add_argument('--vector-database', help='Database name for vector collection', default=None)
    parser.add_argument('--vector-collection', help='Vector collection name', 
                       default='corpus_vector_search')
    parser.add_argument('--batch-size', type=int, default=100, help='Batch size for processing')
    parser.add_argument('--no-skip-existing', action='store_true', 
                       help='Regenerate embeddings for existing documents')
    parser.add_argument('--provider', help='Embedding provider (openai, huggingface)', default=None)
    parser.add_argument('--model', help='Embedding model name', default=None)
    parser.add_argument('--api-key', help='API key for embedding provider', default=None)
    
    args = parser.parse_args()
    
    if not args.mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    generate_embeddings_for_corpus(
        args.corpus_name,
        args.mongodb_uri,
        args.database,
        args.vector_database,
        args.vector_collection,
        args.batch_size,
        skip_existing=not args.no_skip_existing,
        provider=args.provider,
        model_name=args.model,
        api_key=args.api_key
    )
