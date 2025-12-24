#!/usr/bin/env python3
"""
Extract Aditya Hridaya Stotra from Ramayana JSON and write to MongoDB.

Extracts verses from Yuddha Kanda, Sarga 107 (Aditya Hridaya Stotra) from the
Ramayana JSON file and writes them to MongoDB.
"""

import os
import sys
import json
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


def extract_aditya_hridaya_to_mongodb(
    json_path: str,
    mongodb_uri: str,
    database_name: str = 'aditya_hridaya_stotra'
):
    """
    Extract Aditya Hridaya Stotra verses from JSON file and write to MongoDB.
    
    Args:
        json_path: Path to the Ramayana JSON file
        mongodb_uri: MongoDB connection string
        database_name: Name of the database (defaults to aditya_hridaya_stotra)
    """
    print("Aditya Hridaya Stotra - Extract to MongoDB")
    print("=" * 60)
    print(f"JSON file: {json_path}")
    print(f"Database: {database_name}")
    print("=" * 60)
    
    # Check if JSON file exists
    if not os.path.exists(json_path):
        print(f"Error: JSON file not found: {json_path}")
        sys.exit(1)
    
    # Load JSON file
    print(f"\nLoading {json_path}...")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            all_verses = json.load(f)
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Filter for Yuddha Kanda, Sarga 107
    print("Filtering for Yuddha Kanda, Sarga 107...")
    filtered_verses = [
        verse for verse in all_verses
        if verse.get('kanda') == 'Yuddha Kanda' and verse.get('sarga') == 107
    ]
    
    if not filtered_verses:
        print("Error: No verses found for Yuddha Kanda, Sarga 107")
        sys.exit(1)
    
    print(f"✓ Found {len(filtered_verses)} verses")
    
    # Transform verses to MongoDB documents
    print("\nTransforming verses to MongoDB documents...")
    documents = []
    for verse in filtered_verses:
        shloka_num = verse.get('shloka', 0)
        doc = {
            '_id': f"verse_107_{shloka_num}",
            'kanda': verse.get('kanda'),
            'sarga': verse.get('sarga'),
            'shloka': shloka_num,
            'shloka_text': verse.get('shloka_text', ''),
            'transliteration': verse.get('transliteration'),
            'translation': verse.get('translation', ''),
            'explanation': verse.get('explanation', ''),
            'comments': verse.get('comments'),
            'created_at': datetime.utcnow()
        }
        documents.append(doc)
    
    # Sort by shloka number
    documents.sort(key=lambda x: x['shloka'])
    
    print(f"✓ Prepared {len(documents)} documents")
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Get collection
    collection = db['verses']
    
    # Insert documents
    print(f"\nInserting {len(documents)} documents into MongoDB...")
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
                update_fields = {k: v for k, v in doc.items() if k != '_id'}
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
    
    # Print summary
    print("\n" + "=" * 60)
    print("Summary:")
    print(f"  Inserted: {inserted_count}")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Total: {len(documents)}")
    print("=" * 60)
    
    client.close()
    print("\n✓ Done!")

