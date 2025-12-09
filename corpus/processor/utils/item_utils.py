"""
Item utilities for corpus processing.

Functions for generating unique IDs and sorting items.
"""

from typing import Dict, List, Optional


def get_unique_id(item: Dict) -> str:
    """
    Generate unique identifier for an item.
    
    Args:
        item: Item dictionary with type and verse_number/prose_number
        
    Returns:
        Unique identifier string (e.g., "verse_0.1", "prose_2.3")
    """
    item_type = item.get('type', 'unknown')
    if item_type == 'verse':
        verse_number = item.get('verse_number', '')
        return f"verse_{verse_number}"
    elif item_type == 'prose':
        prose_number = item.get('prose_number', '')
        return f"prose_{prose_number}"
    else:
        return f"{item_type}_{item.get('verse_number') or item.get('prose_number', 'unknown')}"


def get_chapter_from_verse_number(verse_number: str) -> Optional[int]:
    """
    Extract chapter number from verse number.
    
    Args:
        verse_number: Verse number string (e.g., "0.1", "2.146")
        
    Returns:
        Chapter number as integer or None
    """
    if not verse_number:
        return None
    try:
        chapter = int(verse_number.split('.')[0])
        return chapter
    except (ValueError, IndexError):
        return None


def sort_items(items: List[Dict]) -> List[Dict]:
    """
    Sort items by type and number.
    
    Verses come first, then prose. Both are sorted by chapter and number.
    
    Args:
        items: List of item dictionaries
        
    Returns:
        Sorted list of items
    """
    def sort_key(item):
        item_type = item.get('type', 'unknown')
        if item_type == 'verse':
            verse_num = item.get('verse_number', '0.0')
            try:
                chapter, verse = map(int, verse_num.split('.'))
                return (0, chapter, verse)  # 0 for verse
            except (ValueError, AttributeError):
                return (0, 0, 0)
        elif item_type == 'prose':
            prose_num = item.get('prose_number', '0.0')
            try:
                chapter, prose_idx = map(int, prose_num.split('.'))
                return (1, chapter, prose_idx)  # 1 for prose
            except (ValueError, AttributeError):
                return (1, 0, 0)
        else:
            return (2, 0, 0)
    
    sorted_items = items.copy()
    sorted_items.sort(key=sort_key)
    return sorted_items

