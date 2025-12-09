"""
Text processing utilities for Devanagari Sanskrit text.

Functions for splitting and processing Devanagari text.
"""

from typing import List


def split_devanagari_words(text: str) -> List[str]:
    """
    Split Devanagari text into individual words.
    
    Handles punctuation, spaces, and common separators.
    
    Args:
        text: Devanagari text string
        
    Returns:
        List of words (may include punctuation as separate items)
    """
    # Remove extra whitespace
    text = text.strip()
    
    # Split by spaces, but preserve punctuation markers like |
    # We'll keep punctuation separate for now
    words = []
    current_word = []
    
    for char in text:
        # Devanagari Unicode range: \u0900-\u097F
        if '\u0900' <= char <= '\u097F':
            current_word.append(char)
        elif char in ' \n\t':
            if current_word:
                words.append(''.join(current_word))
                current_word = []
        elif char in '|':
            # Keep punctuation as separate item
            if current_word:
                words.append(''.join(current_word))
                current_word = []
            words.append(char)
        else:
            # Other characters (like hyphens in compound words)
            if current_word:
                words.append(''.join(current_word))
                current_word = []
            if char.strip():  # Only add non-whitespace
                words.append(char)
    
    # Add any remaining word
    if current_word:
        words.append(''.join(current_word))
    
    # Filter out empty strings
    words = [w for w in words if w.strip()]
    
    return words

