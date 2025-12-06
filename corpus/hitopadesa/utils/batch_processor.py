"""
Batch processing utilities.

Functions for splitting items into batches and processing them.
"""

from typing import List, Dict, Callable, Any


def create_batches(items: List[Dict], batch_size: int) -> List[List[Dict]]:
    """
    Split items into batches of specified size.
    
    Args:
        items: List of items to batch
        batch_size: Size of each batch
        
    Returns:
        List of batches (each batch is a list of items)
    """
    batches = []
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        batches.append(batch)
    return batches

