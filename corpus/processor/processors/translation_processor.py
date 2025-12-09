"""
Translation processing for corpus files.

Functions for processing batches of items with translations.
"""

import time
from typing import List, Dict, Set, Optional

from processor.translators import translate_devanagari_complete
from processor.utils.item_utils import get_unique_id


def process_batch(
    batch: List[Dict],
    api_key: str,
    model: str,
    delay: float = 1.0,
    already_translated_ids: Optional[Set[str]] = None
) -> List[Dict]:
    """
    Process a batch of items and add translations.
    
    Args:
        batch: List of item dictionaries to translate
        api_key: OpenAI API key
        model: OpenAI model to use
        delay: Delay between API calls in seconds
        already_translated_ids: Set of IDs that are already translated (to skip)
        
    Returns:
        List of items with added word_by_word_translation and full_translation fields
    """
    if already_translated_ids is None:
        already_translated_ids = set()
    
    processed_items = []
    
    for item in batch:
        unique_id = get_unique_id(item)
        
        # Skip if already translated
        if unique_id in already_translated_ids:
            print(f"  ⊘ Skipping {unique_id} (already translated)")
            continue
        
        item_type = item.get('type', 'unknown')
        item_number = item.get('verse_number') or item.get('prose_number', 'unknown')
        devanagari_text = item.get('transliterated_devanagari', '')
        
        if not devanagari_text:
            print(f"  ⚠ Warning: {item_type.capitalize()} {item_number} has no Devanagari text, skipping")
            continue
        
        print(f"  → Processing {item_type} {item_number}...")
        
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
            
            print(f"    ✓ Translated {len(translations)} words")
            print(f"    ✓ Full: {full_translation[:60]}..." if len(full_translation) > 60 else f"    ✓ Full: {full_translation}")
            
            # Rate limiting: delay between API calls
            time.sleep(delay)
                
        except Exception as e:
            print(f"    ✗ Error translating {item_type} {item_number}: {e}")
            # Continue with next item
            continue
    
    return processed_items

