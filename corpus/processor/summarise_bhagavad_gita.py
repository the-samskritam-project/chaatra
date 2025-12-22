#!/usr/bin/env python3
"""
Summarize Bhagavad Gita chapters.

Reads all chapter collections in the bhagavad_gita_shankara_bhasya database
and creates a chapters_metadata collection with chapter metadata.
"""

import os
import sys
import re
from datetime import datetime
from typing import Dict, List, Optional

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


def discover_chapter_collections(db) -> List[int]:
    """
    Discover all chapter collections matching pattern chapter_\d+.
    
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


def summarise_bhagavad_gita(
    mongodb_uri: str,
    database_name: str = 'bhagavad_gita_shankara_bhasya',
    clear_existing: bool = False
):
    """
    Summarize Bhagavad Gita chapters and create metadata collection.
    
    Args:
        mongodb_uri: MongoDB connection string
        database_name: Name of the database (defaults to bhagavad_gita_shankara_bhasya)
        clear_existing: If True, clear existing chapters collection before populating
    """
    print("Bhagavad Gita Chapter Summarization")
    print("=" * 60)
    print(f"Database: {database_name}")
    print("=" * 60)
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Discover chapter collections
    print(f"\nDiscovering chapter collections...")
    chapter_numbers = discover_chapter_collections(db)
    
    if not chapter_numbers:
        print("Error: No chapter collections found (expected pattern: chapter_N)")
        client.close()
        sys.exit(1)
    
    print(f"✓ Found {len(chapter_numbers)} chapter collections")
    
    # Create or clear chapters collection
    chapters_collection = db['chapters_metadata']
    
    if clear_existing:
        print(f"\nClearing existing chapters collection...")
        chapters_collection.delete_many({})
        print("✓ Cleared existing chapters")
    
    # Process each chapter
    print(f"\nProcessing chapters...")
    metadata_docs = []
    
    for chapter_num in chapter_numbers:
        collection_name = f"chapter_{chapter_num}"
        collection = db[collection_name]
        
        # Count verses and commentaries
        verse_count = collection.count_documents({'type': 'original_verse'})
        commentary_count = collection.count_documents({'type': 'commentary'})
        
        # Find min and max sequence numbers
        # Get all documents with sequence_number
        docs_with_sequence = list(collection.find(
            {'sequence_number': {'$exists': True, '$ne': None}},
            {'sequence_number': 1}
        ))
        
        if docs_with_sequence:
            sequence_numbers = [doc.get('sequence_number') for doc in docs_with_sequence if doc.get('sequence_number') is not None]
            if sequence_numbers:
                start_sequence = min(sequence_numbers)
                end_sequence = max(sequence_numbers)
            else:
                start_sequence = None
                end_sequence = None
        else:
            start_sequence = None
            end_sequence = None
        
        # Create metadata document
        metadata_doc = {
            'chapter_number': chapter_num,
            'chapter_name': f'Chapter {chapter_num}',
            'verse_count': verse_count,
            'commentary_count': commentary_count,
            'start_sequence': start_sequence,
            'end_sequence': end_sequence,
            'created_at': datetime.utcnow()
        }
        
        metadata_docs.append(metadata_doc)
        
        print(f"  Chapter {chapter_num}: {verse_count} verses, {commentary_count} commentaries, "
              f"sequence {start_sequence}-{end_sequence}")
    
    # Insert metadata documents
    print(f"\nInserting chapter metadata...")
    inserted_count = 0
    updated_count = 0
    skipped_count = 0
    
    for doc in metadata_docs:
        try:
            # Try to insert, but update if document already exists
            result = chapters_collection.update_one(
                {'chapter_number': doc['chapter_number']},
                {'$set': doc},
                upsert=True
            )
            if result.upserted_id:
                inserted_count += 1
            else:
                updated_count += 1
        except Exception as e:
            print(f"  ⚠ Error processing chapter {doc['chapter_number']}: {e}")
            skipped_count += 1
    
    print(f"✓ Inserted {inserted_count} new chapters, updated {updated_count} existing chapters")
    if skipped_count > 0:
        print(f"  ⚠ Skipped {skipped_count} chapters due to errors")
    
    # Summary
    total_verses = sum(doc['verse_count'] for doc in metadata_docs)
    total_commentaries = sum(doc['commentary_count'] for doc in metadata_docs)
    
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Total chapters: {len(metadata_docs)}")
    print(f"  Total verses: {total_verses}")
    print(f"  Total commentaries: {total_commentaries}")
    print(f"{'='*60}")
    
    client.close()
    print("\n✓ Summarization completed!")


if __name__ == '__main__':
    # This script is typically called from command_processor.py
    # But can be used standalone with proper arguments
    import argparse
    
    parser = argparse.ArgumentParser(description='Summarize Bhagavad Gita chapters')
    parser.add_argument('--mongodb-uri', help='MongoDB connection URI', 
                       default=os.getenv('MONGODB_URI'))
    parser.add_argument('--database', help='Database name', 
                       default='bhagavad_gita_shankara_bhasya')
    parser.add_argument('--clear-existing', action='store_true', 
                       help='Clear existing chapters collection before populating')
    
    args = parser.parse_args()
    
    if not args.mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    summarise_bhagavad_gita(
        args.mongodb_uri,
        args.database,
        args.clear_existing
    )

