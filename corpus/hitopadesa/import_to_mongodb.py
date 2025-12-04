#!/usr/bin/env python3
"""
Import Hitopadesa verses into MongoDB.

Reads hitopadesa_verses_translated.json and imports into MongoDB with:
- Metadata collection: hitopadesa_chapters
- Chapter collections: hitopadesa_chapter_0, hitopadesa_chapter_1, etc.
"""

import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Tuple

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure, DuplicateKeyError
except ImportError:
    print("Error: pymongo not installed. Install with: pip install pymongo")
    sys.exit(1)


def parse_verse_number(verse_number: str) -> Tuple[int, int]:
    """
    Parse verse number format "chapter.verse" into chapter and verse numbers.
    
    Args:
        verse_number: String in format "chapter.verse" (e.g., "0.1", "4.141")
        
    Returns:
        Tuple of (chapter_number, verse_number)
    """
    try:
        parts = verse_number.split('.')
        if len(parts) != 2:
            raise ValueError(f"Invalid verse number format: {verse_number}")
        chapter = int(parts[0])
        verse = int(parts[1])
        return chapter, verse
    except (ValueError, IndexError) as e:
        raise ValueError(f"Failed to parse verse number '{verse_number}': {e}")


def connect_mongodb(connection_string: str, database_name: str = "hitopadesa"):
    """
    Connect to MongoDB and return database object.
    
    Args:
        connection_string: MongoDB connection URI
        database_name: Name of the database to use
        
    Returns:
        MongoDB database object
        
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


def group_verses_by_chapter(verses: List[Dict]) -> Dict[int, List[Dict]]:
    """
    Group verses by chapter number.
    
    Args:
        verses: List of verse dictionaries
        
    Returns:
        Dictionary mapping chapter numbers to lists of verses
    """
    chapters = defaultdict(list)
    
    for verse in verses:
        verse_number = verse.get('verse_number', '')
        if not verse_number:
            print(f"Warning: Verse missing verse_number, skipping")
            continue
        
        try:
            chapter_num, verse_num = parse_verse_number(verse_number)
            # Add chapter and verse info to verse document
            verse['chapter_number'] = chapter_num
            verse['verse_index'] = verse_num
            chapters[chapter_num].append(verse)
        except ValueError as e:
            print(f"Warning: {e}, skipping verse")
            continue
    
    # Sort verses within each chapter by verse_index
    for chapter_num in chapters:
        chapters[chapter_num].sort(key=lambda v: v.get('verse_index', 0))
    
    return dict(chapters)


def create_chapter_metadata(chapters: Dict[int, List[Dict]]) -> List[Dict]:
    """
    Create metadata documents for each chapter.
    
    Args:
        chapters: Dictionary mapping chapter numbers to verse lists
        
    Returns:
        List of metadata documents
    """
    metadata = []
    
    for chapter_num in sorted(chapters.keys()):
        verses = chapters[chapter_num]
        if not verses:
            continue
        
        verse_numbers = [v.get('verse_number', '') for v in verses]
        verse_numbers = [v for v in verse_numbers if v]
        
        metadata_doc = {
            "chapter_number": chapter_num,
            "verse_count": len(verses),
            "first_verse": verse_numbers[0] if verse_numbers else None,
            "last_verse": verse_numbers[-1] if verse_numbers else None,
            "created_at": datetime.utcnow()
        }
        metadata.append(metadata_doc)
    
    return metadata


def import_to_mongodb(
    json_path: str,
    mongodb_uri: str,
    database_name: str = "hitopadesa",
    clear_existing: bool = False
):
    """
    Import Hitopadesa verses into MongoDB.
    
    Args:
        json_path: Path to hitopadesa_verses_translated.json
        mongodb_uri: MongoDB connection string
        database_name: Name of the database
        clear_existing: If True, clear existing collections before importing
    """
    # Load verses from JSON
    print(f"Loading verses from {json_path}...")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            verses = json.load(f)
        print(f"✓ Loaded {len(verses)} verses")
    except FileNotFoundError:
        print(f"Error: File {json_path} not found")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse JSON file: {e}")
        sys.exit(1)
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Group verses by chapter
    print(f"\nGrouping verses by chapter...")
    chapters = group_verses_by_chapter(verses)
    print(f"✓ Found {len(chapters)} chapters")
    for chapter_num in sorted(chapters.keys()):
        print(f"  Chapter {chapter_num}: {len(chapters[chapter_num])} verses")
    
    # Create metadata collection
    print(f"\nCreating metadata collection...")
    metadata_collection = db['hitopadesa_chapters']
    
    if clear_existing:
        print("  Clearing existing metadata...")
        metadata_collection.delete_many({})
    
    # Create chapter metadata
    metadata_docs = create_chapter_metadata(chapters)
    
    # Insert metadata
    try:
        result = metadata_collection.insert_many(metadata_docs, ordered=False)
        print(f"✓ Inserted {len(result.inserted_ids)} chapter metadata documents")
    except DuplicateKeyError:
        print("  Warning: Some metadata documents already exist (skipping duplicates)")
    except Exception as e:
        print(f"  Error inserting metadata: {e}")
    
    # Import verses into chapter collections
    print(f"\nImporting verses into chapter collections...")
    total_imported = 0
    total_errors = 0
    
    for chapter_num in sorted(chapters.keys()):
        verses = chapters[chapter_num]
        collection_name = f"hitopadesa_chapter_{chapter_num}"
        collection = db[collection_name]
        
        if clear_existing:
            print(f"  Clearing existing verses in {collection_name}...")
            collection.delete_many({})
        
        # Prepare documents for insertion
        documents = []
        for verse in verses:
            # Ensure chapter_number and verse_index are set
            if 'chapter_number' not in verse:
                chapter_num_parsed, verse_num_parsed = parse_verse_number(verse.get('verse_number', ''))
                verse['chapter_number'] = chapter_num_parsed
                verse['verse_index'] = verse_num_parsed
            documents.append(verse)
        
        # Insert verses
        try:
            if documents:
                result = collection.insert_many(documents, ordered=False)
                imported_count = len(result.inserted_ids)
                total_imported += imported_count
                print(f"  ✓ Chapter {chapter_num}: Inserted {imported_count} verses into {collection_name}")
        except DuplicateKeyError:
            print(f"  ⚠ Chapter {chapter_num}: Some verses already exist (skipping duplicates)")
        except Exception as e:
            print(f"  ✗ Chapter {chapter_num}: Error inserting verses: {e}")
            total_errors += len(documents)
    
    print(f"\n{'='*60}")
    print(f"Import Summary:")
    print(f"  Total verses imported: {total_imported}")
    print(f"  Total errors: {total_errors}")
    print(f"  Chapters processed: {len(chapters)}")
    print(f"{'='*60}")
    
    client.close()
    print("\n✓ Import completed!")


def main():
    """Main function."""
    # Load environment variables from .env file in corpus directory (parent)
    if load_dotenv:
        # Load from corpus/.env (parent directory)
        env_path = os.path.join(os.path.dirname(__file__), '../.env')
        load_dotenv(dotenv_path=env_path)
    
    # Get configuration
    json_path = 'hitopadesa_verses_translated.json'
    mongodb_uri = os.getenv('MONGODB_URI')
    database_name = os.getenv('MONGODB_DATABASE', 'hitopadesa')
    clear_existing = os.getenv('CLEAR_EXISTING', 'false').lower() == 'true'
    
    if not mongodb_uri:
        print("Error: MONGODB_URI environment variable not set")
        print("Please set it in your .env file or environment:")
        print("  MONGODB_URI=mongodb://localhost:27017/")
        print("  MONGODB_DATABASE=hitopadesa  (optional, defaults to 'hitopadesa')")
        print("  CLEAR_EXISTING=true  (optional, to clear existing data)")
        sys.exit(1)
    
    print("Hitopadesa MongoDB Import")
    print("=" * 60)
    print(f"JSON file: {json_path}")
    print(f"Database: {database_name}")
    print(f"Clear existing: {clear_existing}")
    print("=" * 60)
    
    import_to_mongodb(json_path, mongodb_uri, database_name, clear_existing)


if __name__ == '__main__':
    main()

