"""
Text processing utilities for corpus processing.

Functions for cleaning and processing verse and prose text.
"""

import re
from typing import Optional


def clean_verse_text(text: str, verse_pattern: str) -> str:
    """
    Remove verse number markers and clean up text.
    
    Args:
        text: Verse text with markers
        verse_pattern: Regex pattern for verse numbers (will be used to remove markers)
        
    Returns:
        Cleaned verse text
    """
    # Remove verse number markers using the pattern
    # Replace the capture group with empty string to remove the marker
    text = re.sub(verse_pattern, '', text)
    # Clean up extra whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def clean_prose_text(text: str) -> str:
    """
    Clean up prose text.
    
    Args:
        text: Prose text
        
    Returns:
        Cleaned prose text
    """
    # Clean up extra whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def is_prose_title_or_marker(text: str) -> bool:
    """
    Check if prose text is just a title or marker that should be skipped.
    
    Args:
        text: Prose text to check
        
    Returns:
        True if text should be skipped
    """
    text = text.strip().lower()
    # Skip patterns like "kathā 9", "maṅgalācaraṇam", "vidyā-praśaṃsā"
    if re.match(r'^(kathā\s+\d+|maṅgalācaraṇam|vidyā-praśaṃsā)$', text):
        return True
    # Skip very short text (likely titles)
    if len(text) < 5:
        return True
    return False

