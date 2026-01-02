"""Import Apte dictionary command handler."""

import os
import sys
import json
import argparse
import hashlib
from datetime import datetime
from typing import List, Dict

try:
    from pymongo.errors import ConnectionFailure, DuplicateKeyError
except ImportError:
    print("Error: pymongo not installed. Install with: pip install pymongo")
    sys.exit(1)

from processor.utils.mongodb_utils import connect_mongodb
from . import register_command
from .common_args import add_batch_size_arg


def import_apte_dictionary(
    json_path: str,
    mongodb_uri: str,
    database_name: str = "apte_dictionary",
    collection_name: str = "entries",
    batch_size: int = 1000,
    clear_existing: bool = False
):
    """
    Import Apte dictionary entries from JSON to MongoDB.
    
    Args:
        json_path: Path to apte_parsed_dictionary.json file
        mongodb_uri: MongoDB connection URI
        database_name: Database name (default: apte_dictionary)
        collection_name: Collection name (default: entries)
        batch_size: Batch size for processing (default: 1000)
        clear_existing: If True, clear existing collection before importing
    """
    # Connect to MongoDB
    print(f"Connecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Get collection
    collection = db[collection_name]
    
    if clear_existing:
        print(f"Clearing existing collection {collection_name}...")
        collection.delete_many({})
    
    # Read JSON file
    print(f"Reading dictionary from {json_path}...")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            entries = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found: {json_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {json_path}: {e}")
        sys.exit(1)
    
    print(f"✓ Loaded {len(entries)} dictionary entries")
    
    # Process in batches
    total_batches = (len(entries) + batch_size - 1) // batch_size
    total_inserted = 0
    total_updated = 0
    total_skipped = 0
    total_errors = 0
    
    print(f"\nProcessing {len(entries)} entries in {total_batches} batches...")
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(entries))
        batch = entries[start_idx:end_idx]
        
        documents = []
        for entry in batch:
            # Use existing id as _id, or generate one if missing
            doc_id = entry.get('id')
            if not doc_id:
                # Generate a simple ID from slp1Str and sanskritString if id is missing
                id_str = f"{entry.get('slp1Str', '')}_{entry.get('sanskritString', '')}_{entry.get('sense', '')}"
                doc_id = hashlib.md5(id_str.encode('utf-8')).hexdigest()
            
            # Prepare document
            doc = entry.copy()
            doc['_id'] = doc_id
            doc['created_at'] = datetime.utcnow()
            
            documents.append(doc)
        
        # Insert documents
        inserted_count = 0
        updated_count = 0
        skipped_count = 0
        
        for doc in documents:
            try:
                collection.insert_one(doc)
                inserted_count += 1
            except DuplicateKeyError:
                # Update existing document
                try:
                    # Update all fields except _id
                    update_fields = {k: v for k, v in doc.items() if k != '_id'}
                    update_fields['created_at'] = datetime.utcnow()  # Update timestamp
                    
                    collection.update_one(
                        {'_id': doc['_id']},
                        {'$set': update_fields}
                    )
                    updated_count += 1
                except Exception as e:
                    print(f"  ⚠ Error updating {doc.get('_id')}: {e}")
                    skipped_count += 1
            except Exception as e:
                print(f"  ⚠ Error inserting {doc.get('_id')}: {e}")
                skipped_count += 1
        
        total_inserted += inserted_count
        total_updated += updated_count
        total_skipped += skipped_count
        total_errors += skipped_count
        
        if updated_count > 0:
            print(f"  Batch {batch_num + 1}/{total_batches}: Inserted {inserted_count}, Updated {updated_count}, Skipped {skipped_count}")
        else:
            print(f"  Batch {batch_num + 1}/{total_batches}: Inserted {inserted_count}, Skipped {skipped_count}")
    
    print(f"\n{'='*60}")
    print(f"Import Summary:")
    print(f"  Total entries processed: {len(entries)}")
    print(f"  Inserted: {total_inserted}")
    print(f"  Updated: {total_updated}")
    print(f"  Skipped: {total_skipped}")
    print(f"  Errors: {total_errors}")
    print(f"{'='*60}")
    
    client.close()
    print("\n✓ Import completed!")


def handle(args):
    """Execute import Apte dictionary command."""
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    # Default JSON path
    json_path = args.json_path or os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'data',
        'apte_parsed_dictionary.json'
    )
    
    database_name = args.database or "apte_dictionary"
    
    import_apte_dictionary(
        json_path=json_path,
        mongodb_uri=mongodb_uri,
        database_name=database_name,
        collection_name=args.collection,
        batch_size=args.batch_size,
        clear_existing=args.clear_existing
    )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for import_apte_dictionary command."""
    # Note: add_common_args is called automatically by command_processor.py
    add_batch_size_arg(subparser, default=1000)
    subparser.add_argument(
        '--json-path',
        help='Path to apte_parsed_dictionary.json file (default: corpus/data/apte_parsed_dictionary.json)'
    )
    subparser.add_argument(
        '--collection',
        default='entries',
        help='Collection name (default: entries)'
    )
    subparser.add_argument(
        '--clear-existing',
        action='store_true',
        help='Clear existing collection before importing'
    )


register_command('import_apte_dictionary', handle, add_arguments, requires_corpus=False)

