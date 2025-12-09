#!/usr/bin/env python3
"""
Import Hitopadesa verses into MongoDB.

Reads from hitopadesa_raw_translated MongoDB collection and imports into MongoDB with:
- Metadata collection: hitopadesa_chapters
- Chapter collections: hitopadesa_chapter_0, hitopadesa_chapter_1, etc.
"""

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
    from pymongo.errors import ConnectionFailure, DuplicateKeyError
except ImportError:
    print("Error: pymongo not installed. Install with: pip install pymongo")
    sys.exit(1)

from utils.mongodb_utils import connect_mongodb
from utils.item_utils import get_unique_id


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


def parse_prose_number(prose_number: str) -> Tuple[int, int]:
    """
    Parse prose number format "chapter.prose_index" into chapter and prose index.
    
    Args:
        prose_number: String in format "chapter.prose_index" (e.g., "0.1", "2.3")
        
    Returns:
        Tuple of (chapter_number, prose_index)
    """
    try:
        parts = prose_number.split('.')
        if len(parts) != 2:
            raise ValueError(f"Invalid prose number format: {prose_number}")
        chapter = int(parts[0])
        prose_idx = int(parts[1])
        return chapter, prose_idx
    except (ValueError, IndexError) as e:
        raise ValueError(f"Failed to parse prose number '{prose_number}': {e}")


def group_items_by_chapter(items: List[Dict]) -> Dict[int, List[Dict]]:
    """
    Group verses and prose by chapter number.
    
    Args:
        items: List of item dictionaries (verses and prose)
        
    Returns:
        Dictionary mapping chapter numbers to lists of items
    """
    chapters = defaultdict(list)
    
    for item in items:
        item_type = item.get('type', 'unknown')
        
        if item_type == 'verse':
            verse_number = item.get('verse_number', '')
            if not verse_number:
                print(f"Warning: Verse missing verse_number, skipping")
                continue
            
            try:
                chapter_num, verse_num = parse_verse_number(verse_number)
                # Add chapter and verse info to verse document
                item['chapter_number'] = chapter_num
                item['verse_index'] = verse_num
                chapters[chapter_num].append(item)
            except ValueError as e:
                print(f"Warning: {e}, skipping verse")
                continue
        
        elif item_type == 'prose':
            prose_number = item.get('prose_number', '')
            chapter_number = item.get('chapter_number')
            
            if not prose_number and not chapter_number:
                print(f"Warning: Prose missing prose_number and chapter_number, skipping")
                continue
            
            try:
                if prose_number:
                    chapter_num, prose_idx = parse_prose_number(prose_number)
                    item['chapter_number'] = chapter_num
                    item['prose_index'] = prose_idx
                elif chapter_number:
                    chapter_num = chapter_number
                    # Try to extract prose_index from prose_number if available
                    if prose_number:
                        _, prose_idx = parse_prose_number(prose_number)
                        item['prose_index'] = prose_idx
                    else:
                        item['prose_index'] = 0  # Default if not available
                
                chapters[chapter_num].append(item)
            except ValueError as e:
                print(f"Warning: {e}, skipping prose")
                continue
        else:
            print(f"Warning: Unknown item type '{item_type}', skipping")
            continue
    
    # Sort items within each chapter by sequence_index to preserve interleaved order
    for chapter_num in chapters:
        chapters[chapter_num].sort(key=lambda item: item.get('sequence_index', 0))
    
    return dict(chapters)


def create_chapter_metadata(chapters: Dict[int, List[Dict]]) -> List[Dict]:
    """
    Create metadata documents for each chapter.
    
    Args:
        chapters: Dictionary mapping chapter numbers to item lists (verses and prose)
        
    Returns:
        List of metadata documents
    """
    metadata = []
    
    for chapter_num in sorted(chapters.keys()):
        items = chapters[chapter_num]
        if not items:
            continue
        
        verses = [item for item in items if item.get('type') == 'verse']
        prose = [item for item in items if item.get('type') == 'prose']
        
        verse_numbers = [v.get('verse_number', '') for v in verses if v.get('verse_number')]
        prose_numbers = [p.get('prose_number', '') for p in prose if p.get('prose_number')]
        
        metadata_doc = {
            "chapter_number": chapter_num,
            "verse_count": len(verses),
            "prose_count": len(prose),
            "total_count": len(items),
            "first_verse": verse_numbers[0] if verse_numbers else None,
            "last_verse": verse_numbers[-1] if verse_numbers else None,
            "first_prose": prose_numbers[0] if prose_numbers else None,
            "last_prose": prose_numbers[-1] if prose_numbers else None,
            "created_at": datetime.utcnow()
        }
        metadata.append(metadata_doc)
    
    return metadata


def import_to_mongodb(
    mongodb_uri: str,
    database_name: str = "hitopadesa",
    clear_existing: bool = False
):
    """
    Import Hitopadesa verses and prose into MongoDB.
    
    Reads from hitopadesa_raw_translated collection and organizes into chapter collections.
    
    Args:
        mongodb_uri: MongoDB connection string
        database_name: Name of the database
        clear_existing: If True, clear existing collections before importing
    """
    # Connect to MongoDB
    print(f"Connecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Load items from hitopadesa_raw_translated collection
    print(f"Loading items from hitopadesa_raw_translated collection...")
    translated_collection = db['hitopadesa_raw_translated']
    all_items = list(translated_collection.find({}))
    
    if not all_items:
        print("Error: No items found in hitopadesa_raw_translated collection")
        print("Please run translate_verses.py first to populate the collection")
        client.close()
        sys.exit(1)
    
    verse_count = sum(1 for item in all_items if item.get('type') == 'verse')
    prose_count = sum(1 for item in all_items if item.get('type') == 'prose')
    
    print(f"✓ Loaded {len(all_items)} items ({verse_count} verses, {prose_count} prose)")
    
    # Group items by chapter
    print(f"\nGrouping items by chapter...")
    chapters = group_items_by_chapter(all_items)
    print(f"✓ Found {len(chapters)} chapters")
    for chapter_num in sorted(chapters.keys()):
        items = chapters[chapter_num]
        verse_count_ch = sum(1 for item in items if item.get('type') == 'verse')
        prose_count_ch = sum(1 for item in items if item.get('type') == 'prose')
        print(f"  Chapter {chapter_num}: {len(items)} items ({verse_count_ch} verses, {prose_count_ch} prose)")
    
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
        items = chapters[chapter_num]
        collection_name = f"hitopadesa_chapter_{chapter_num}"
        collection = db[collection_name]
        
        if clear_existing:
            print(f"  Clearing existing items in {collection_name}...")
            collection.delete_many({})
        
        # Prepare documents for insertion
        documents = []
        for idx, item in enumerate(items, 1):
            item_type = item.get('type')
            
            # Ensure chapter_number and indices are set
            if item_type == 'verse':
                if 'chapter_number' not in item:
                    chapter_num_parsed, verse_num_parsed = parse_verse_number(item.get('verse_number', ''))
                    item['chapter_number'] = chapter_num_parsed
                    item['verse_index'] = verse_num_parsed
            elif item_type == 'prose':
                if 'chapter_number' not in item and item.get('prose_number'):
                    chapter_num_parsed, prose_idx_parsed = parse_prose_number(item.get('prose_number', ''))
                    item['chapter_number'] = chapter_num_parsed
                    item['prose_index'] = prose_idx_parsed
                elif 'prose_index' not in item and item.get('prose_number'):
                    _, prose_idx_parsed = parse_prose_number(item.get('prose_number', ''))
                    item['prose_index'] = prose_idx_parsed
            
            # Ensure sequence_index is preserved if it exists
            # Don't set it to None - only preserve what's already there
            # If missing, it will be None and we won't update it
            # (sequence_index should come from the source items in hitopadesa_raw_translated)
            
            # Calculate chapter_sequence_index if missing (based on sorted order)
            # Items are already sorted by sequence_index, so position in list = chapter sequence
            if 'chapter_sequence_index' not in item or item.get('chapter_sequence_index') is None:
                item['chapter_sequence_index'] = idx
            
            documents.append(item)
        
        # Insert or update items
        inserted_count = 0
        updated_count = 0
        skipped_count = 0
        
        for doc in documents:
            # Create unique ID for the document
            unique_id = get_unique_id(doc)
            doc['_id'] = unique_id
            
            try:
                collection.insert_one(doc)
                inserted_count += 1
            except DuplicateKeyError:
                # Update existing document with sequence numbers and other fields
                try:
                    update_fields = {}
                    
                    # Always update sequence numbers (they should be in doc from preparation above)
                    # Only update sequence_index if it has a value (not None)
                    # Always update chapter_sequence_index since we calculate it
                    if doc.get('sequence_index') is not None:
                        update_fields['sequence_index'] = doc.get('sequence_index')
                    
                    # Always update chapter_sequence_index (we calculate it above)
                    if 'chapter_sequence_index' in doc and doc.get('chapter_sequence_index') is not None:
                        update_fields['chapter_sequence_index'] = doc.get('chapter_sequence_index')
                    
                    # Update other metadata fields that might have changed
                    for field in ['type', 'verse_number', 'prose_number', 'chapter_number',
                                 'verse_index', 'prose_index', 'original_iast', 
                                 'transliterated_devanagari', 'word_by_word_translation',
                                 'full_translation']:
                        if field in doc:
                            update_fields[field] = doc.get(field)
                    
                    if update_fields:
                        collection.update_one(
                            {'_id': unique_id},
                            {'$set': update_fields}
                        )
                        updated_count += 1
                    else:
                        skipped_count += 1
                except Exception as e:
                    print(f"  ⚠ Error updating {unique_id}: {e}")
                    skipped_count += 1
            except Exception as e:
                print(f"  ⚠ Error inserting {unique_id}: {e}")
                skipped_count += 1
        
        if documents:
            verse_count_ch = sum(1 for item in documents if item.get('type') == 'verse')
            prose_count_ch = sum(1 for item in documents if item.get('type') == 'prose')
            if updated_count > 0:
                print(f"  ✓ Chapter {chapter_num}: Inserted {inserted_count}, Updated {updated_count}, Skipped {skipped_count} items ({verse_count_ch} verses, {prose_count_ch} prose) into {collection_name}")
            else:
                print(f"  ✓ Chapter {chapter_num}: Inserted {inserted_count}, Skipped {skipped_count} items ({verse_count_ch} verses, {prose_count_ch} prose) into {collection_name}")
        
        total_imported += inserted_count + updated_count
        total_errors += skipped_count
    
    total_verses_imported = sum(
        sum(1 for item in chapters[ch] if item.get('type') == 'verse')
        for ch in chapters.keys()
    )
    total_prose_imported = sum(
        sum(1 for item in chapters[ch] if item.get('type') == 'prose')
        for ch in chapters.keys()
    )
    
    print(f"\n{'='*60}")
    print(f"Import Summary:")
    print(f"  Total items imported: {total_imported}")
    print(f"    - Verses: {total_verses_imported}")
    print(f"    - Prose: {total_prose_imported}")
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
    print(f"Source collection: hitopadesa_raw_translated")
    print(f"Database: {database_name}")
    print(f"Clear existing: {clear_existing}")
    print("=" * 60)
    
    import_to_mongodb(mongodb_uri, database_name, clear_existing)


if __name__ == '__main__':
    main()

