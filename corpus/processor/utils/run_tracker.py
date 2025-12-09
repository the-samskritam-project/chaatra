"""
Run tracking utilities for translation runs.

Functions for creating and updating translation run metadata.
"""

import uuid
from datetime import datetime
from typing import Optional

try:
    from pymongo.database import Database
except ImportError:
    print("Error: pymongo not installed. Install with: pip install pymongo")
    raise


def create_or_get_run(db: Database, model: str, corpus_name: str) -> str:
    """
    Create a new translation run or get the latest running run.
    
    Args:
        db: MongoDB database object
        model: Model being used for translation
        corpus_name: Name of the corpus (for collection naming)
        
    Returns:
        Run ID string
    """
    run_collection = db[f'{corpus_name}_translation_run']
    
    # Check for existing running run
    running_run = run_collection.find_one({'status': 'running'}, sort=[('started_at', -1)])
    
    if running_run:
        run_id = running_run['run_id']
        print(f"Resuming existing run: {run_id}")
        return run_id
    
    # Create new run
    run_id = str(uuid.uuid4())
    run_doc = {
        'run_id': run_id,
        'started_at': datetime.utcnow(),
        'last_updated_at': datetime.utcnow(),
        'status': 'running',
        'total_items': 0,
        'processed_items': 0,
        'current_batch': 0,
        'model_used': model,
        'error_message': None
    }
    
    run_collection.insert_one(run_doc)
    print(f"Created new translation run: {run_id}")
    return run_id


def update_run_progress(
    db: Database,
    run_id: str,
    processed_items: int,
    total_items: int,
    current_batch: int,
    corpus_name: str,
    status: str = 'running',
    error_message: Optional[str] = None
):
    """
    Update translation run progress.
    
    Args:
        db: MongoDB database object
        run_id: Run ID string
        processed_items: Number of items processed so far
        total_items: Total number of items to process
        current_batch: Current batch number
        corpus_name: Name of the corpus (for collection naming)
        status: Run status (running/completed/failed)
        error_message: Optional error message
    """
    run_collection = db[f'{corpus_name}_translation_run']
    
    update_doc = {
        '$set': {
            'last_updated_at': datetime.utcnow(),
            'processed_items': processed_items,
            'total_items': total_items,
            'current_batch': current_batch,
            'status': status
        }
    }
    
    if error_message:
        update_doc['$set']['error_message'] = error_message
    
    run_collection.update_one({'run_id': run_id}, update_doc)

