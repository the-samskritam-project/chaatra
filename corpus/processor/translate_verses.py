#!/usr/bin/env python3
"""
Process verses and prose, adding word-by-word translations using OpenAI.

Reads from {corpus_name}_raw_transliterated MongoDB collection,
processes items in batches, and writes to {corpus_name}_raw_translated collection.
Tracks progress in {corpus_name}_translation_run collection for resume capability.

Supports both verse and prose items with batch processing and progress tracking.
"""

import os
import sys
from datetime import datetime

try:
    from dotenv import load_dotenv
except ImportError:
    print("Warning: python-dotenv not installed. Install with: pip install python-dotenv")
    load_dotenv = None

try:
    from pymongo.errors import ConnectionFailure
except ImportError:
    print("Error: pymongo not installed. Install with: pip install pymongo")
    sys.exit(1)

from processor.utils.mongodb_utils import (
    connect_mongodb,
    load_items_from_mongodb,
    get_already_translated_ids,
    write_translated_batch_to_mongodb
)
from processor.utils.run_tracker import create_or_get_run, update_run_progress
from processor.processors.translation_processor import process_batch
from processor.utils.item_utils import get_unique_id
from processor.utils.batch_processor import create_batches


def translate_verses(
    corpus_name: str,
    mongodb_uri: str,
    database_name: str = None,
    batch_size: int = 10,
    delay: float = 1.0,
    skip_translation: bool = False,
    api_key: str = None,
    model: str = 'gpt-4o'
):
    """
    Process verses and prose and write to MongoDB in batches.
    
    Args:
        corpus_name: Name of the corpus (for collection naming)
        mongodb_uri: MongoDB connection string
        database_name: Name of the database (defaults to corpus_name)
        batch_size: Size of batches for processing
        delay: Delay between API calls in seconds
        skip_translation: If True, skip translation and only update metadata
        api_key: OpenAI API key (required if skip_translation is False)
        model: OpenAI model to use
    """
    if database_name is None:
        database_name = corpus_name
    
    print(f"{corpus_name.capitalize()} Translation to MongoDB")
    print("=" * 60)
    print(f"Database: {database_name}")
    print(f"Input collection: {corpus_name}_raw_transliterated")
    print(f"Output collection: {corpus_name}_raw_translated")
    print(f"Run tracking: {corpus_name}_translation_run")
    print(f"Skip translation: {skip_translation}")
    if not skip_translation:
        print(f"Model: {model}")
    print(f"Batch size: {batch_size}")
    print("=" * 60)
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
        transliterated_collection = db[f'{corpus_name}_raw_transliterated']
        translated_collection = db[f'{corpus_name}_raw_translated']
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Load items from transliterated collection
    print(f"\nLoading items from {corpus_name}_raw_transliterated...")
    items = load_items_from_mongodb(transliterated_collection)
    
    if not items:
        print(f"Error: No items found in {corpus_name}_raw_transliterated collection")
        print("Please run transliterate_xml.py first")
        client.close()
        sys.exit(1)
    
    verse_count = sum(1 for item in items if item.get('type') == 'verse')
    prose_count = sum(1 for item in items if item.get('type') == 'prose')
    
    print(f"Loaded {len(items)} items")
    print(f"  - {verse_count} verses")
    print(f"  - {prose_count} prose entries")
    
    # Get already translated IDs for resume
    print(f"\nChecking for already translated items...")
    already_translated_ids = get_already_translated_ids(translated_collection)
    already_count = len(already_translated_ids)
    print(f"Found {already_count} already translated items")
    
    try:
        if skip_translation:
            # Skip translation mode: copy items with updated sequence numbers
            print(f"\nSkip translation mode: Copying items with updated sequence numbers...")
            items_to_process = items  # Process all items to update sequence numbers
            remaining_count = len(items_to_process)
            
            # Create or get run
            run_id = create_or_get_run(db, 'skip-translation', corpus_name)
            update_run_progress(db, run_id, already_count, len(items), 0, corpus_name)
            
            # Process in batches
            print(f"\nProcessing {remaining_count} items in batches of {batch_size}...")
            batches = create_batches(items_to_process, batch_size)
            total_batches = len(batches)
            total_inserted = 0
            total_updated = 0
            
            try:
                for batch_num, batch in enumerate(batches, 1):
                    print(f"\n--- Batch {batch_num}/{total_batches} ---")
                    
                    # Prepare batch with sequence numbers (no translation)
                    batch_with_metadata = []
                    for item in batch:
                        # Copy item with all metadata including sequence numbers
                        item_copy = item.copy()
                        # Preserve existing translations if item already exists
                        unique_id = get_unique_id(item)
                        if unique_id in already_translated_ids:
                            existing_item = translated_collection.find_one({'_id': unique_id})
                            if existing_item:
                                # Preserve translation fields
                                item_copy['word_by_word_translation'] = existing_item.get('word_by_word_translation')
                                item_copy['full_translation'] = existing_item.get('full_translation')
                                item_copy['translated_at'] = existing_item.get('translated_at', datetime.utcnow())
                                item_copy['translation_model'] = existing_item.get('translation_model', 'skip-translation')
                        
                        batch_with_metadata.append(item_copy)
                    
                    # Write batch to MongoDB
                    if batch_with_metadata:
                        inserted = write_translated_batch_to_mongodb(
                            batch_with_metadata,
                            translated_collection,
                            'skip-translation',
                            batch_num,
                            total_batches
                        )
                        total_inserted += inserted
                        total_updated += len(batch_with_metadata)
                    
                    # Update run progress
                    processed_so_far = batch_num * batch_size
                    if processed_so_far > len(items):
                        processed_so_far = len(items)
                    
                    update_run_progress(
                        db,
                        run_id,
                        processed_so_far,
                        len(items),
                        batch_num,
                        corpus_name
                    )
                
                # Mark run as completed
                update_run_progress(
                    db,
                    run_id,
                    len(items),
                    len(items),
                    total_batches,
                    corpus_name,
                    status='completed'
                )
                
                print(f"\n{'='*60}")
                print(f"Metadata Update Summary:")
                print(f"  Total items: {len(items)}")
                print(f"  Items processed: {total_updated}")
                print(f"  Items inserted/updated: {total_inserted}")
                print(f"  Verses: {verse_count}")
                print(f"  Prose entries: {prose_count}")
                print(f"  Run ID: {run_id}")
                print(f"{'='*60}")
            except KeyboardInterrupt:
                print("\n\n⚠ Process interrupted by user")
                update_run_progress(
                    db,
                    run_id,
                    total_updated,
                    len(items),
                    (total_updated // batch_size) + 1,
                    corpus_name,
                    status='running',
                    error_message='Interrupted by user'
                )
                print(f"Progress saved. Run ID: {run_id}")
                print("You can resume by running this script again.")
            except Exception as e:
                print(f"\n\n✗ Critical error: {e}")
                update_run_progress(
                    db,
                    run_id,
                    total_updated,
                    len(items),
                    (total_updated // batch_size) + 1,
                    corpus_name,
                    status='failed',
                    error_message=str(e)
                )
                raise
        else:
            # Normal translation mode
            if not api_key:
                print("Error: OPENAI_API_KEY not found")
                print("Please set it in one of the following ways:")
                print("  1. Create a .env file with: OPENAI_API_KEY=your-api-key")
                print("  2. Or set environment variable: export OPENAI_API_KEY='your-api-key'")
                print("  3. Or set skip_translation=true to skip translation and only update metadata")
                client.close()
                sys.exit(1)
            
            # Filter out already translated items
            items_to_process = [item for item in items if get_unique_id(item) not in already_translated_ids]
            remaining_count = len(items_to_process)
            
            if remaining_count == 0:
                print("\nAll items are already translated!")
                client.close()
                return
            
            print(f"Items remaining to translate: {remaining_count}")
            
            # Create or get run
            run_id = create_or_get_run(db, model, corpus_name)
            update_run_progress(db, run_id, already_count, len(items), 0, corpus_name)
            
            # Process in batches
            print(f"\nProcessing {remaining_count} items in batches of {batch_size}...")
            batches = create_batches(items_to_process, batch_size)
            total_batches = len(batches)
            total_inserted = 0
            total_errors = 0
            
            try:
                for batch_num, batch in enumerate(batches, 1):
                    print(f"\n--- Batch {batch_num}/{total_batches} ---")
                    
                    # Process batch
                    translated_batch = process_batch(
                        batch,
                        api_key,
                        model,
                        delay=delay,
                        already_translated_ids=already_translated_ids
                    )
                    
                    # Write batch to MongoDB
                    if translated_batch:
                        inserted = write_translated_batch_to_mongodb(
                            translated_batch,
                            translated_collection,
                            model,
                            batch_num,
                            total_batches
                        )
                        total_inserted += inserted
                    
                    # Update run progress
                    processed_so_far = already_count + (batch_num * batch_size)
                    if processed_so_far > len(items):
                        processed_so_far = len(items)
                    
                    update_run_progress(
                        db,
                        run_id,
                        processed_so_far,
                        len(items),
                        batch_num,
                        corpus_name
                    )
                
                # Mark run as completed
                update_run_progress(
                    db,
                    run_id,
                    len(items),
                    len(items),
                    total_batches,
                    corpus_name,
                    status='completed'
                )
                
                print(f"\n{'='*60}")
                print(f"Translation Summary:")
                print(f"  Total items: {len(items)}")
                print(f"  Already translated: {already_count}")
                print(f"  Newly translated: {total_inserted}")
                print(f"  Verses: {verse_count}")
                print(f"  Prose entries: {prose_count}")
                print(f"  Run ID: {run_id}")
                print(f"{'='*60}")
            
            except KeyboardInterrupt:
                print("\n\n⚠ Process interrupted by user")
                update_run_progress(
                    db,
                    run_id,
                    already_count + total_inserted,
                    len(items),
                    (total_inserted // batch_size) + 1,
                    corpus_name,
                    status='running',  # Keep as running so it can be resumed
                    error_message='Interrupted by user'
                )
                print(f"Progress saved. Run ID: {run_id}")
                print("You can resume by running this script again.")
            except Exception as e:
                print(f"\n\n✗ Critical error: {e}")
                update_run_progress(
                    db,
                    run_id,
                    already_count + total_inserted,
                    len(items),
                    (total_inserted // batch_size) + 1,
                    corpus_name,
                    status='failed',
                    error_message=str(e)
                )
                raise
    finally:
        client.close()
        print("\n✓ Translation process completed!")


if __name__ == '__main__':
    # This script is typically called from command_processor.py
    # But can be used standalone with proper arguments
    import argparse
    
    parser = argparse.ArgumentParser(description='Translate verses to MongoDB')
    parser.add_argument('corpus_name', help='Name of the corpus')
    parser.add_argument('--mongodb-uri', help='MongoDB connection URI', 
                       default=os.getenv('MONGODB_URI'))
    parser.add_argument('--database', help='Database name', default=None)
    parser.add_argument('--batch-size', type=int, default=10, help='Batch size')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay between API calls')
    parser.add_argument('--skip-translation', action='store_true', 
                       help='Skip translation and only update metadata')
    parser.add_argument('--api-key', help='OpenAI API key', 
                       default=os.getenv('OPENAI_API_KEY'))
    parser.add_argument('--model', default='gpt-4o', help='OpenAI model')
    
    args = parser.parse_args()
    
    if not args.mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    translate_verses(
        args.corpus_name,
        args.mongodb_uri,
        args.database,
        args.batch_size,
        args.delay,
        args.skip_translation,
        args.api_key,
        args.model
    )

