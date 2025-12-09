#!/usr/bin/env python3
"""
Transliterate XML from IAST to Devanagari.

Extracts verses and prose from the XML file and writes to MongoDB in batches.
Stores transliterated items in {corpus_name}_raw_transliterated collection.
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

from processor.parsers.xml_parser import parse_xml
from processor.utils.mongodb_utils import connect_mongodb, write_batch_to_mongodb
from processor.utils.batch_processor import create_batches


def transliterate_xml(
    xml_path: str,
    verse_pattern: str,
    corpus_name: str,
    mongodb_uri: str,
    database_name: str = None,
    batch_size: int = 10
):
    """
    Transliterate XML file and write to MongoDB.
    
    Args:
        xml_path: Path to the XML file
        verse_pattern: Regex pattern for verse numbers
        corpus_name: Name of the corpus (for collection naming)
        mongodb_uri: MongoDB connection string
        database_name: Name of the database (defaults to corpus_name)
        batch_size: Size of batches for writing to MongoDB
    """
    if database_name is None:
        database_name = corpus_name
    
    print(f"{corpus_name.capitalize()} Transliteration to MongoDB")
    print("=" * 60)
    print(f"XML file: {xml_path}")
    print(f"Database: {database_name}")
    print(f"Collection: {corpus_name}_raw_transliterated")
    print(f"Batch size: {batch_size}")
    print("=" * 60)
    
    # Parse XML
    print(f"\nParsing {xml_path}...")
    all_items = parse_xml(xml_path, verse_pattern)
    
    verse_count = sum(1 for item in all_items if item['type'] == 'verse')
    prose_count = sum(1 for item in all_items if item['type'] == 'prose')
    
    print(f"Found {verse_count} verses")
    print(f"Found {prose_count} prose entries")
    print(f"Total items: {len(all_items)}")
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
        collection = db[f'{corpus_name}_raw_transliterated']
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
    # This script is typically called from command_processor.py
    # But can be used standalone with proper arguments
    import argparse
    
    parser = argparse.ArgumentParser(description='Transliterate XML to MongoDB')
    parser.add_argument('xml_path', help='Path to XML file')
    parser.add_argument('verse_pattern', help='Regex pattern for verse numbers')
    parser.add_argument('corpus_name', help='Name of the corpus')
    parser.add_argument('--mongodb-uri', help='MongoDB connection URI', 
                       default=os.getenv('MONGODB_URI'))
    parser.add_argument('--database', help='Database name', default=None)
    parser.add_argument('--batch-size', type=int, default=10, help='Batch size')
    
    args = parser.parse_args()
    
    if not args.mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    transliterate_xml(
        args.xml_path,
        args.verse_pattern,
        args.corpus_name,
        args.mongodb_uri,
        args.database,
        args.batch_size
    )

