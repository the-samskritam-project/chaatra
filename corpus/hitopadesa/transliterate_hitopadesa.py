#!/usr/bin/env python3
"""
Transliterate Hitopadesa XML from IAST to Devanagari.

Extracts verses and prose from the XML file and writes to MongoDB in batches.
Stores transliterated items in hitopadesa_raw_transliterated collection.
"""

import os
import sys

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

try:
    from pymongo.errors import ConnectionFailure
except ImportError:
    print("Error: pymongo not installed. Install with: pip install pymongo")
    sys.exit(1)

from parsers.xml_parser import parse_hitopadesa_xml
from utils.mongodb_utils import connect_mongodb, write_batch_to_mongodb
from utils.batch_processor import create_batches


def main():
    """Main function to process XML and write to MongoDB in batches."""
    xml_path = '../hitopadesa/hitopadesa.xml'
    batch_size = 10
    
    # Load environment variables
    if load_dotenv:
        env_path = os.path.join(os.path.dirname(__file__), '../.env')
        load_dotenv(dotenv_path=env_path)
    
    # Get MongoDB configuration
    mongodb_uri = os.getenv('MONGODB_URI')
    database_name = os.getenv('MONGODB_DATABASE', 'hitopadesa')
    
    if not mongodb_uri:
        print("Error: MONGODB_URI environment variable not set")
        print("Please set it in your .env file or environment:")
        print("  MONGODB_URI=mongodb://localhost:27017/")
        print("  MONGODB_DATABASE=hitopadesa  (optional, defaults to 'hitopadesa')")
        sys.exit(1)
    
    print("Hitopadesa Transliteration to MongoDB")
    print("=" * 60)
    print(f"XML file: {xml_path}")
    print(f"Database: {database_name}")
    print(f"Collection: hitopadesa_raw_transliterated")
    print(f"Batch size: {batch_size}")
    print("=" * 60)
    
    # Parse XML
    print(f"\nParsing {xml_path}...")
    all_items = parse_hitopadesa_xml(xml_path)
    
    verse_count = sum(1 for item in all_items if item['type'] == 'verse')
    prose_count = sum(1 for item in all_items if item['type'] == 'prose')
    
    print(f"Found {verse_count} verses")
    print(f"Found {prose_count} prose entries")
    print(f"Total items: {len(all_items)}")
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
        collection = db['hitopadesa_raw_transliterated']
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Process in batches
    print(f"\nWriting to MongoDB in batches of {batch_size}...")
    batches = create_batches(all_items, batch_size)
    total_batches = len(batches)
    total_inserted = 0
    
    for batch_num, batch in enumerate(batches, 1):
        inserted = write_batch_to_mongodb(batch, collection, batch_num, total_batches)
        total_inserted += inserted
    
    print(f"\n{'='*60}")
    print(f"Transliteration Summary:")
    print(f"  Total items processed: {len(all_items)}")
    print(f"  Items inserted: {total_inserted}")
    print(f"  Items skipped (already exist): {len(all_items) - total_inserted}")
    print(f"  Verses: {verse_count}")
    print(f"  Prose entries: {prose_count}")
    print(f"{'='*60}")
    
    client.close()
    print("\n✓ Transliteration completed!")


if __name__ == '__main__':
    main()
