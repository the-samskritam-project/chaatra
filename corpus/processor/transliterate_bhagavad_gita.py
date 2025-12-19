#!/usr/bin/env python3
"""
Transliterate Bhagavad Gita XML from IAST to Devanagari.

Extracts chapters, verses, and commentary from the XML file and writes to MongoDB
in per-chapter collections with batch processing.
"""

import os
import sys
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

from processor.parsers.bhagavad_gita_parser import parse_bhagavad_gita_xml
from processor.utils.mongodb_utils import connect_mongodb


def transliterate_bhagavad_gita(
    xml_path: str,
    mongodb_uri: str,
    database_name: str = 'bhagavad_gita_shankara_bhasya',
    batch_size: int = 50
):
    """
    Transliterate Bhagavad Gita XML file and write to MongoDB.
    
    Args:
        xml_path: Path to the XML file
        mongodb_uri: MongoDB connection string
        database_name: Name of the database (defaults to bhagavad_gita_shankara_bhasya)
        batch_size: Size of batches for writing to MongoDB
    """
    print("Bhagavad Gita with Shankara's Bhasya - Transliteration to MongoDB")
    print("=" * 60)
    print(f"XML file: {xml_path}")
    print(f"Database: {database_name}")
    print(f"Batch size: {batch_size}")
    print("=" * 60)
    
    # Parse XML
    print(f"\nParsing {xml_path}...")
    try:
        chapters = parse_bhagavad_gita_xml(xml_path)
    except Exception as e:
        print(f"Error parsing XML: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Count items
    total_verses = 0
    total_commentary = 0
    for chapter_items in chapters.values():
        total_verses += sum(1 for item in chapter_items if item['type'] == 'original_verse')
        total_commentary += sum(1 for item in chapter_items if item['type'] == 'commentary')
    
    print(f"\nFound {len(chapters)} chapters")
    print(f"Found {total_verses} verses")
    print(f"Found {total_commentary} commentary paragraphs")
    print(f"Total items: {total_verses + total_commentary}")
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Process each chapter
    total_inserted = 0
    total_updated = 0
    total_skipped = 0
    
    for chapter_num in sorted(chapters.keys()):
        items = chapters[chapter_num]
        collection_name = f'chapter_{chapter_num}'
        collection = db[collection_name]
        
        chapter_verses = sum(1 for item in items if item['type'] == 'original_verse')
        chapter_commentary = sum(1 for item in items if item['type'] == 'commentary')
        
        print(f"\nProcessing Chapter {chapter_num} ({len(items)} items: {chapter_verses} verses, {chapter_commentary} commentary)...")
        
        # Process in batches
        inserted_count = 0
        updated_count = 0
        skipped_count = 0
        total_batches = (len(items) + batch_size - 1) // batch_size
        
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            batch_num = i // batch_size + 1
            documents = []
            
            for item in batch:
                # Create unique ID based on type and identifier
                if item['type'] == 'original_verse':
                    unique_id = f"verse_{item['verse_number']}"
                else:
                    unique_id = f"commentary_{item['chapter_number']}_{item['sequence_number']}"
                
                # Prepare document
                doc = item.copy()
                doc['_id'] = unique_id
                doc['created_at'] = datetime.utcnow()
                # Remove 'text' field if present (it's redundant with original_iast)
                doc.pop('text', None)
                documents.append(doc)
            
            # Insert documents
            for doc in documents:
                try:
                    collection.insert_one(doc)
                    inserted_count += 1
                    total_inserted += 1
                except DuplicateKeyError:
                    # Update existing document
                    try:
                        update_fields = {k: v for k, v in doc.items() if k != '_id'}
                        collection.update_one(
                            {'_id': doc['_id']},
                            {'$set': update_fields}
                        )
                        updated_count += 1
                        total_updated += 1
                    except Exception as e:
                        print(f"  ⚠ Error updating {doc.get('_id')}: {e}")
                        skipped_count += 1
                        total_skipped += 1
                except Exception as e:
                    print(f"  ⚠ Error inserting {doc.get('_id')}: {e}")
                    skipped_count += 1
                    total_skipped += 1
            
            if batch_num % 10 == 0 or batch_num == total_batches:
                print(f"  Batch {batch_num}/{total_batches}: Inserted {inserted_count}, Updated {updated_count}, Skipped {skipped_count}")
        
        print(f"  Chapter {chapter_num} summary: {chapter_verses} verses, {chapter_commentary} commentary paragraphs")
        print(f"  Total: {inserted_count} inserted, {updated_count} updated, {skipped_count} skipped")
    
    print(f"\n{'='*60}")
    print(f"Transliteration Summary:")
    print(f"  Total chapters: {len(chapters)}")
    print(f"  Total verses: {total_verses}")
    print(f"  Total commentary paragraphs: {total_commentary}")
    print(f"  Total items: {total_verses + total_commentary}")
    print(f"  Items inserted: {total_inserted}")
    print(f"  Items updated: {total_updated}")
    print(f"  Items skipped: {total_skipped}")
    print(f"{'='*60}")
    
    client.close()
    print("\n✓ Transliteration completed!")


if __name__ == '__main__':
    # This script is typically called from command_processor.py
    # But can be used standalone with proper arguments
    import argparse
    
    parser = argparse.ArgumentParser(description='Transliterate Bhagavad Gita XML to MongoDB')
    parser.add_argument('xml_path', help='Path to XML file')
    parser.add_argument('--mongodb-uri', help='MongoDB connection URI', 
                       default=os.getenv('MONGODB_URI'))
    parser.add_argument('--database', help='Database name', 
                       default='bhagavad_gita_shankara_bhasya')
    parser.add_argument('--batch-size', type=int, default=50, help='Batch size')
    
    args = parser.parse_args()
    
    if not args.mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    if not os.path.exists(args.xml_path):
        print(f"Error: XML file not found: {args.xml_path}")
        sys.exit(1)
    
    transliterate_bhagavad_gita(
        args.xml_path,
        args.mongodb_uri,
        args.database,
        args.batch_size
    )

