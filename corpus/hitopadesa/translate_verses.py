#!/usr/bin/env python3
"""
Process Hitopadesa verses and prose, adding word-by-word translations using OpenAI.

Reads from hitopadesa_raw_transliterated MongoDB collection,
processes items in batches, and writes to hitopadesa_raw_translated collection.
Tracks progress in hitopadesa_translation_run collection for resume capability.

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

from utils.mongodb_utils import (
    connect_mongodb,
    load_items_from_mongodb,
    get_already_translated_ids,
    write_translated_batch_to_mongodb
)
from utils.run_tracker import create_or_get_run, update_run_progress
from processors.translation_processor import process_batch
from utils.item_utils import get_unique_id
from utils.batch_processor import create_batches


def main():
    """Main function to process verses and prose and write to MongoDB in batches."""
    batch_size = 10
    delay = 1.0  # Delay between API calls in seconds
    
    # Load environment variables
    if load_dotenv:
        env_path = os.path.join(os.path.dirname(__file__), '../.env')
        load_dotenv(dotenv_path=env_path)
    
    # Get configuration
    mongodb_uri = os.getenv('MONGODB_URI')
    database_name = os.getenv('MONGODB_DATABASE', 'hitopadesa')
    skip_translation = os.getenv('SKIP_TRANSLATION', 'false').lower() == 'true'
    api_key = os.getenv('OPENAI_API_KEY')
    model = os.getenv('OPENAI_MODEL', 'gpt-4o')
    
    if not mongodb_uri:
        print("Error: MONGODB_URI environment variable not set")
        print("Please set it in your .env file or environment:")
        print("  MONGODB_URI=mongodb://localhost:27017/")
        sys.exit(1)
    
    if not skip_translation and not api_key:
        print("Error: OPENAI_API_KEY not found")
        print("Please set it in one of the following ways:")
        print("  1. Create a .env file with: OPENAI_API_KEY=your-api-key")
        print("  2. Or set environment variable: export OPENAI_API_KEY='your-api-key'")
        print("  3. Or set SKIP_TRANSLATION=true to skip translation and only update metadata")
        sys.exit(1)
    
    print("Hitopadesa Translation to MongoDB")
    print("=" * 60)
    print(f"Database: {database_name}")
    print(f"Input collection: hitopadesa_raw_transliterated")
    print(f"Output collection: hitopadesa_raw_translated")
    print(f"Run tracking: hitopadesa_translation_run")
    print(f"Skip translation: {skip_translation}")
    if not skip_translation:
        print(f"Model: {model}")
    print(f"Batch size: {batch_size}")
    print("=" * 60)
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
        transliterated_collection = db['hitopadesa_raw_transliterated']
        translated_collection = db['hitopadesa_raw_translated']
    except ConnectionFailure as e:
        print(f"Error: {e}")
        sys.exit(1)
    
    # Load items from transliterated collection
    print(f"\nLoading items from hitopadesa_raw_transliterated...")
    items = load_items_from_mongodb(transliterated_collection)
    
    if not items:
        print("Error: No items found in hitopadesa_raw_transliterated collection")
        print("Please run transliterate_hitopadesa.py first")
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
            run_id = create_or_get_run(db, 'skip-translation')
            update_run_progress(db, run_id, already_count, len(items), 0)
            
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
                        batch_num
                    )
                
                # Mark run as completed
                update_run_progress(
                    db,
                    run_id,
                    len(items),
                    len(items),
                    total_batches,
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
                    status='failed',
                    error_message=str(e)
                )
                raise
        else:
            # Normal translation mode
            # Filter out already translated items
            items_to_process = [item for item in items if get_unique_id(item) not in already_translated_ids]
            remaining_count = len(items_to_process)
            
            if remaining_count == 0:
                print("\nAll items are already translated!")
                return
            
            print(f"Items remaining to translate: {remaining_count}")
            
            # Create or get run
            run_id = create_or_get_run(db, model)
            update_run_progress(db, run_id, already_count, len(items), 0)
            
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
                        batch_num
                    )
                
                # Mark run as completed
                update_run_progress(
                    db,
                    run_id,
                    len(items),
                    len(items),
                    total_batches,
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
                    status='failed',
                    error_message=str(e)
                )
                raise
    finally:
        client.close()
        print("\n✓ Translation process completed!")


if __name__ == '__main__':
    main()
