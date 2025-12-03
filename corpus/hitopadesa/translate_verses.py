#!/usr/bin/env python3
"""
Process Hitopadesa verses and add word-by-word translations using OpenAI.

Reads hitopadesa_verses.json, processes the first 10 verses,
and outputs hitopadesa_verses_translated.json with translations.
"""

import json
import os
import sys
import time
from typing import List, Dict, Optional

try:
    from dotenv import load_dotenv
except ImportError:
    print("Warning: python-dotenv not installed. Install with: pip install python-dotenv")
    load_dotenv = None

from translator import translate_devanagari_complete


def load_verses(json_path: str) -> List[Dict]:
    """Load verses from JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_verses(verses: List[Dict], output_path: str) -> None:
    """Save verses to JSON file."""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(verses, f, ensure_ascii=False, indent=2)


def process_verses(
    verses: List[Dict],
    api_key: str,
    limit: Optional[int] = None,
    delay: float = 1.0
) -> List[Dict]:
    """
    Process verses and add word-by-word translations.
    
    Args:
        verses: List of verse dictionaries
        api_key: OpenAI API key
        limit: Number of verses to process (None = all verses)
        delay: Delay between API calls in seconds (default: 1.0)
        
    Returns:
        List of verses with added word_by_word_translation field
    """
    processed_verses = []
    processed_count = 0
    total_to_process = limit if limit is not None else len(verses)
    
    for i, verse in enumerate(verses):
        if limit is not None and processed_count >= limit:
            # Add remaining verses without translation
            processed_verses.append(verse)
            continue
        
        verse_number = verse.get('verse_number', f'unknown_{i}')
        devanagari_text = verse.get('transliterated_devanagari', '')
        
        if not devanagari_text:
            print(f"Warning: Verse {verse_number} has no Devanagari text, skipping translation")
            processed_verses.append(verse)
            continue
        
        print(f"Processing verse {verse_number} ({processed_count + 1}/{total_to_process})...")
        
        try:
            # Translate with both word-by-word and full translation in one call
            translations, full_translation = translate_devanagari_complete(devanagari_text, api_key)
            
            # Add translations to verse
            verse_with_translation = verse.copy()
            verse_with_translation['word_by_word_translation'] = translations
            verse_with_translation['full_translation'] = full_translation
            
            processed_verses.append(verse_with_translation)
            processed_count += 1
            
            print(f"  ✓ Translated {len(translations)} words")
            print(f"  ✓ Full translation: {full_translation[:60]}..." if len(full_translation) > 60 else f"  ✓ Full translation: {full_translation}")
            
            # Rate limiting: delay between API calls
            if (limit is None or processed_count < limit) and i < len(verses) - 1:
                time.sleep(delay)
                
        except Exception as e:
            print(f"  ✗ Error translating verse {verse_number}: {e}")
            # Add verse without translation
            processed_verses.append(verse)
            continue
    
    return processed_verses


def main():
    """Main function to process verses and generate translated JSON."""
    input_path = 'hitopadesa_verses.json'
    output_path = 'hitopadesa_verses_translated.json'
    
    # Load environment variables from .env file if available
    if load_dotenv:
        load_dotenv()
    
    # Get API key from environment (from .env file or environment variable)
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("Error: OPENAI_API_KEY not found")
        print("Please set it in one of the following ways:")
        print("  1. Create a .env file with: OPENAI_API_KEY=your-api-key")
        print("  2. Or set environment variable: export OPENAI_API_KEY='your-api-key'")
        sys.exit(1)
    
    print(f"Loading verses from {input_path}...")
    try:
        verses = load_verses(input_path)
        print(f"Loaded {len(verses)} verses")
    except FileNotFoundError:
        print(f"Error: File {input_path} not found")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse JSON file: {e}")
        sys.exit(1)
    
    # Process all verses
    print(f"\nProcessing all {len(verses)} verses...")
    processed_verses = process_verses(verses, api_key, limit=None)
    
    print(f"\nSaving to {output_path}...")
    save_verses(processed_verses, output_path)
    
    translated_count = sum(
        1 for v in processed_verses 
        if 'word_by_word_translation' in v and v['word_by_word_translation']
    )
    
    full_translated_count = sum(
        1 for v in processed_verses 
        if 'full_translation' in v and v['full_translation']
    )
    
    print(f"\nDone! Processed {translated_count} verses with word-by-word translations.")
    print(f"Processed {full_translated_count} verses with full translations.")
    print(f"Output saved to {output_path}")


if __name__ == '__main__':
    main()

