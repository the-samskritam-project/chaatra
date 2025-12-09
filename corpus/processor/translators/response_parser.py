"""
Response parsing utilities for OpenAI translation responses.

Functions for parsing word-by-word and full translations from API responses.
"""

import re
from typing import List, Dict, Tuple

from processor.translators.text_processing import split_devanagari_words


def parse_translation_response(
    response_text: str, 
    original_words: List[str]
) -> List[Dict[str, str]]:
    """
    Parse OpenAI translation response into word-translation pairs.
    
    Args:
        response_text: Raw response from OpenAI
        original_words: List of original Devanagari words
        
    Returns:
        List of dictionaries with 'word' and 'translation' keys
    """
    translations = []
    
    # Split by lines first
    lines = response_text.split('\n')
    
    # Build a mapping from response - try multiple patterns
    word_translation_map = {}
    translation_list = []  # Ordered list to preserve sequence
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Pattern 1: word (translation)
        match = re.search(r'([\u0900-\u097F]+)\s*[\(:]\s*([^\)]+)', line)
        if match:
            word = match.group(1)
            translation = match.group(2).strip().rstrip(')').strip()
            word_translation_map[word] = translation
            translation_list.append((word, translation))
            continue
        
        # Pattern 2: word - translation
        parts = re.split(r'\s*[-:]\s+', line, 1)
        if len(parts) == 2:
            word = parts[0].strip()
            translation = parts[1].strip()
            if word and any('\u0900' <= c <= '\u097F' for c in word):
                word_translation_map[word] = translation
                translation_list.append((word, translation))
                continue
        
        # Pattern 3: Just word and translation separated by space (if word is Devanagari)
        parts = line.split(None, 1)
        if len(parts) == 2:
            word = parts[0].strip()
            translation = parts[1].strip()
            if word and any('\u0900' <= c <= '\u097F' for c in word):
                word_translation_map[word] = translation
                translation_list.append((word, translation))
    
    # Match original words with translations in order
    # Use the ordered list if available, otherwise use the map
    if translation_list and len(translation_list) == len(original_words):
        # Perfect match - use ordered list
        for i, word in enumerate(original_words):
            if i < len(translation_list):
                resp_word, translation = translation_list[i]
                # Verify it's the same word or close match
                if word == resp_word or word in resp_word or resp_word in word:
                    translations.append({
                        "word": word,
                        "translation": translation
                    })
                else:
                    translations.append({
                        "word": word,
                        "translation": word_translation_map.get(word, "")
                    })
            else:
                translations.append({
                    "word": word,
                    "translation": word_translation_map.get(word, "")
                })
    else:
        # Fallback: match by word
        for word in original_words:
            # Try exact match first
            if word in word_translation_map:
                translations.append({
                    "word": word,
                    "translation": word_translation_map[word]
                })
            else:
                # Try partial match
                found = False
                for resp_word, translation in word_translation_map.items():
                    if word in resp_word or resp_word in word:
                        translations.append({
                            "word": word,
                            "translation": translation
                        })
                        found = True
                        break
                
                if not found:
                    # If we can't find a match, add with empty translation
                    translations.append({
                        "word": word,
                        "translation": ""
                    })
    
    return translations


def parse_combined_translation_response(
    response_text: str,
    original_words: List[str]
) -> Tuple[List[Dict[str, str]], str]:
    """
    Parse combined OpenAI response containing both word-by-word and full translation.
    
    Args:
        response_text: Raw response from OpenAI
        original_words: List of original Devanagari words
        
    Returns:
        Tuple of (word_translations, full_translation)
    """
    # Split response into word-by-word and full translation sections
    word_section = ""
    full_translation = ""
    
    # Try to find the sections
    if "WORD_BY_WORD:" in response_text:
        parts = response_text.split("WORD_BY_WORD:", 1)
        if len(parts) > 1:
            remaining = parts[1]
            if "FULL_TRANSLATION:" in remaining:
                word_section, full_translation = remaining.split("FULL_TRANSLATION:", 1)
                full_translation = full_translation.strip()
            else:
                word_section = remaining
    elif "FULL_TRANSLATION:" in response_text:
        parts = response_text.split("FULL_TRANSLATION:", 1)
        if len(parts) > 1:
            full_translation = parts[1].strip()
            # Word-by-word might be before FULL_TRANSLATION
            word_section = parts[0]
    else:
        # Try to infer - look for word-by-word pattern first
        lines = response_text.split('\n')
        word_lines = []
        full_lines = []
        in_word_section = True
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Check if line looks like word-by-word (contains Devanagari)
            if any('\u0900' <= c <= '\u097F' for c in line) and ('(' in line or ':' in line):
                word_lines.append(line)
                in_word_section = True
            elif in_word_section and not any('\u0900' <= c <= '\u097F' for c in line):
                # Transition to full translation
                in_word_section = False
                full_lines.append(line)
            elif not in_word_section:
                full_lines.append(line)
        
        word_section = '\n'.join(word_lines)
        full_translation = '\n'.join(full_lines).strip()
    
    # Parse word-by-word translations
    word_translations = []
    if word_section:
        word_translations = parse_translation_response(word_section, original_words)
    
    # Clean up full translation
    if not full_translation:
        # If we couldn't find a clear full translation, try to extract it
        # Look for longer sentences that don't contain Devanagari
        lines = response_text.split('\n')
        full_lines = []
        for line in lines:
            line = line.strip()
            if line and not any('\u0900' <= c <= '\u097F' for c in line):
                if len(line) > 20:  # Likely a full translation line
                    full_lines.append(line)
        full_translation = ' '.join(full_lines).strip()
    
    return word_translations, full_translation

