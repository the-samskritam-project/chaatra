"""
MongoDB utilities for Hitopadesa.

Functions for connecting to MongoDB and performing batch operations.
"""

from datetime import datetime
from typing import List, Dict, Set, Tuple

try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure, DuplicateKeyError
    from pymongo.database import Database
    from pymongo.mongo_client import MongoClient as ClientType
except ImportError:
    print("Error: pymongo not installed. Install with: pip install pymongo")
    raise

from utils.item_utils import get_unique_id, get_chapter_from_verse_number, sort_items


def connect_mongodb(connection_string: str, database_name: str = "hitopadesa") -> Tuple[Database, ClientType]:
    """
    Connect to MongoDB and return database object.
    
    Args:
        connection_string: MongoDB connection URI
        database_name: Name of the database to use
        
    Returns:
        Tuple of (database, client)
        
    Raises:
        ConnectionFailure: If connection to MongoDB fails
    """
    try:
        client = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
        # Test connection
        client.admin.command('ping')
        db = client[database_name]
        print(f"✓ Connected to MongoDB database: {database_name}")
        return db, client
    except ConnectionFailure as e:
        raise ConnectionFailure(f"Failed to connect to MongoDB: {e}")


def write_batch_to_mongodb(
    batch: List[Dict],
    collection,
    batch_num: int,
    total_batches: int
) -> int:
    """
    Write a batch of transliterated items to MongoDB collection.
    
    Args:
        batch: List of item dictionaries
        collection: MongoDB collection object
        batch_num: Current batch number (1-indexed)
        total_batches: Total number of batches
        
    Returns:
        Number of items successfully inserted
    """
    if not batch:
        return 0
    
    documents = []
    for item in batch:
        # Create unique ID
        unique_id = get_unique_id(item)
        
        # Prepare document with _id and created_at
        doc = item.copy()
        doc['_id'] = unique_id
        doc['created_at'] = datetime.utcnow()
        
        # Ensure chapter_number is set for verses
        if item.get('type') == 'verse' and 'chapter_number' not in doc:
            verse_number = item.get('verse_number', '')
            chapter = get_chapter_from_verse_number(verse_number)
            if chapter is not None:
                doc['chapter_number'] = chapter
        
        documents.append(doc)
    
    inserted_count = 0
    skipped_count = 0
    
    for doc in documents:
        try:
            collection.insert_one(doc)
            inserted_count += 1
        except DuplicateKeyError:
            skipped_count += 1
        except Exception as e:
            print(f"  ⚠ Error inserting {doc.get('_id')}: {e}")
    
    print(f"  Batch {batch_num}/{total_batches}: Inserted {inserted_count}, Skipped {skipped_count} (already exist)")
    
    return inserted_count


def write_translated_batch_to_mongodb(
    batch: List[Dict],
    collection,
    model: str,
    batch_num: int,
    total_batches: int
) -> int:
    """
    Write a batch of translated items to MongoDB collection.
    
    Args:
        batch: List of translated item dictionaries
        collection: MongoDB collection object for hitopadesa_raw_translated
        model: Model used for translation
        batch_num: Current batch number (1-indexed)
        total_batches: Total number of batches
        
    Returns:
        Number of items successfully inserted/updated
    """
    if not batch:
        return 0
    
    documents = []
    for item in batch:
        # Create unique ID (should match transliterated collection)
        unique_id = get_unique_id(item)
        
        # Prepare document with _id and translation metadata
        doc = item.copy()
        doc['_id'] = unique_id
        doc['translated_at'] = datetime.utcnow()
        doc['translation_model'] = model
        
        documents.append(doc)
    
    inserted_count = 0
    skipped_count = 0
    
    for doc in documents:
        try:
            collection.insert_one(doc)
            inserted_count += 1
        except DuplicateKeyError:
            # Update existing document instead
            try:
                collection.update_one(
                    {'_id': doc['_id']},
                    {'$set': {
                        'word_by_word_translation': doc.get('word_by_word_translation'),
                        'full_translation': doc.get('full_translation'),
                        'translated_at': doc['translated_at'],
                        'translation_model': doc['translation_model']
                    }}
                )
                inserted_count += 1
            except Exception as e:
                print(f"  ⚠ Error updating {doc.get('_id')}: {e}")
                skipped_count += 1
        except Exception as e:
            print(f"  ⚠ Error inserting {doc.get('_id')}: {e}")
            skipped_count += 1
    
    print(f"  Batch {batch_num}/{total_batches}: Inserted/Updated {inserted_count}, Skipped {skipped_count}")
    
    return inserted_count


def load_items_from_mongodb(collection) -> List[Dict]:
    """
    Load all items from MongoDB transliterated collection.
    
    Args:
        collection: MongoDB collection object for hitopadesa_raw_transliterated
        
    Returns:
        List of item dictionaries, sorted by type and number
    """
    items = list(collection.find({}))
    return sort_items(items)


def get_already_translated_ids(collection) -> Set[str]:
    """
    Get set of unique IDs that are already translated.
    
    Args:
        collection: MongoDB collection object for hitopadesa_raw_translated
        
    Returns:
        Set of unique ID strings
    """
    translated_items = collection.find({}, {'_id': 1})
    return {item['_id'] for item in translated_items}

