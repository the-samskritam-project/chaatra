#!/usr/bin/env python3
"""
Process Hitopadesa verses and prose, adding word-by-word translations using OpenAI.

Reads hitopadesa_verses.json (which contains both verses and prose),
processes all items, and outputs hitopadesa_verses_translated.json with translations.

Supports both verse and prose items from the updated JSON format.
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


def load_items(json_path: str) -> List[Dict]:
    """Load verses and prose from JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_items(items: List[Dict], output_path: str) -> None:
    """Save verses and prose to JSON file."""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def process_items(
    items: List[Dict],
    api_key: str,
    limit: Optional[int] = None,
    delay: float = 1.0,
    model: str = "gpt-4o"
) -> List[Dict]:
    """
    Process verses and prose items and add word-by-word translations.
    
    Args:
        items: List of verse/prose dictionaries (with 'type' field)
        api_key: OpenAI API key
        limit: Number of items to process (None = all items)
        delay: Delay between API calls in seconds (default: 1.0)
        model: OpenAI model to use (default: gpt-4o)
        
    Returns:
        List of items with added word_by_word_translation and full_translation fields
    """
    processed_items = []
    processed_count = 0
    total_to_process = limit if limit is not None else len(items)
    
    for i, item in enumerate(items):
        if limit is not None and processed_count >= limit:
            # Add remaining items without translation
            processed_items.append(item)
            continue
        
        item_type = item.get('type', 'unknown')
        item_number = item.get('verse_number') or item.get('prose_number', f'unknown_{i}')
        devanagari_text = item.get('transliterated_devanagari', '')
        
        if not devanagari_text:
            print(f"Warning: {item_type.capitalize()} {item_number} has no Devanagari text, skipping translation")
            processed_items.append(item)
            continue
        
        print(f"Processing {item_type} {item_number} ({processed_count + 1}/{total_to_process})...")
        
        try:
            # Translate with both word-by-word and full translation in one call
            translations, full_translation = translate_devanagari_complete(
                devanagari_text, 
                api_key,
                model=model
            )
            
            # Add translations to item
            item_with_translation = item.copy()
            item_with_translation['word_by_word_translation'] = translations
            item_with_translation['full_translation'] = full_translation
            
            processed_items.append(item_with_translation)
            processed_count += 1
            
            print(f"  ✓ Translated {len(translations)} words")
            print(f"  ✓ Full translation: {full_translation[:60]}..." if len(full_translation) > 60 else f"  ✓ Full translation: {full_translation}")
            
            # Rate limiting: delay between API calls
            if (limit is None or processed_count < limit) and i < len(items) - 1:
                time.sleep(delay)
                
        except Exception as e:
            print(f"  ✗ Error translating {item_type} {item_number}: {e}")
            # Add item without translation
            processed_items.append(item)
            continue
    
    return processed_items


def main():
    """Main function to process verses and prose and generate translated JSON."""
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
    
    # Get model from environment or use default
    model = os.getenv('OPENAI_MODEL', 'gpt-4o')
    
    print(f"Loading items from {input_path}...")
    try:
        items = load_items(input_path)
        print(f"Loaded {len(items)} items")
        
        # Count verses and prose
        verse_count = sum(1 for item in items if item.get('type') == 'verse')
        prose_count = sum(1 for item in items if item.get('type') == 'prose')
        print(f"  - {verse_count} verses")
        print(f"  - {prose_count} prose entries")
    except FileNotFoundError:
        print(f"Error: File {input_path} not found")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse JSON file: {e}")
        sys.exit(1)
    
    # Process all items
    print(f"\nProcessing all {len(items)} items using model: {model}...")
    processed_items = process_items(items, api_key, limit=None, model=model)
    
    print(f"\nSaving to {output_path}...")
    save_items(processed_items, output_path)
    
    translated_count = sum(
        1 for item in processed_items 
        if 'word_by_word_translation' in item and item['word_by_word_translation']
    )
    
    full_translated_count = sum(
        1 for item in processed_items 
        if 'full_translation' in item and item['full_translation']
    )
    
    verse_translated = sum(
        1 for item in processed_items 
        if item.get('type') == 'verse' and 'word_by_word_translation' in item and item['word_by_word_translation']
    )
    
    prose_translated = sum(
        1 for item in processed_items 
        if item.get('type') == 'prose' and 'word_by_word_translation' in item and item['word_by_word_translation']
    )
    
    print(f"\nDone! Processed {translated_count} items with word-by-word translations.")
    print(f"  - {verse_translated} verses")
    print(f"  - {prose_translated} prose entries")
    print(f"Processed {full_translated_count} items with full translations.")
    print(f"Output saved to {output_path}")


if __name__ == '__main__':
    main()

