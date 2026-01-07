#!/usr/bin/env python3
"""
Translate subhashitas using OpenAI.

Randomly selects subhashitas from MongoDB, calls OpenAI to get full translation,
sandhi split, and theme classification, then updates the database.
"""

import json
import re
import time
from datetime import datetime
from typing import List, Optional, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from pymongo.errors import ConnectionFailure
except ImportError:
    ConnectionFailure = Exception  # type: ignore

from processor.translators.api_client import make_openai_request
from processor.utils.mongodb_utils import connect_mongodb


SYSTEM_PROMPT = """You are an expert in Sanskrit language, grammar, and literature. Your task is to provide comprehensive analysis of Sanskrit subhashitas (wise sayings).

You must provide:
1. A complete, accurate English translation
2. Sandhi-split version of the shloka (uncompounded form)
3. Word-by-word translation
4. Theme classification

Be precise, maintain the poetic quality of the translation, and ensure grammatical accuracy."""

USER_PROMPT_TEMPLATE = """Analyze the following Sanskrit subhashita:

Verse Number: {verse_number}
Text (Devanagari): {devanagari_text}

Please provide:
1. Full Translation: A complete, fluent English translation that captures the meaning and poetic quality
2. Sandhi Split: The uncompounded form with all sandhis split, words separated by spaces
3. Word-by-Word Translation: Each word with its English translation
4. Theme: Classify the primary theme and up to 3 secondary themes

Common Subhashita Themes (use descriptive phrases, not single words):
- Wisdom and Learning
- Virtue and Ethics
- Friendship and Relationships
- Wealth and Poverty
- Time and Impermanence
- Duty and Righteousness
- Knowledge and Education
- Character and Conduct
- Nature and World
- Devotion and Spirituality
- Politics and Governance
- Family and Social Life
- Human Nature and Behavior
- Philosophy and Reflection

Return your response as a JSON object with the following structure:
{{
  "full_translation": "Complete English translation of the subhashita",
  "uncompounded_shloka": "Sandhi-split version with words separated by spaces, preserving all dandas (। and ॥)",
  "word_by_word_translation": [
    {{"word": "word1", "translation": "translation1"}},
    {{"word": "word2", "translation": "translation2"}}
  ],
  "theme": {{
    "primary_theme": "Descriptive theme phrase (e.g., 'Wisdom and Learning', not just 'Wisdom')",
    "secondary_themes": ["Descriptive theme phrase 1", "Descriptive theme phrase 2", "Descriptive theme phrase 3"],
    "rationale": "Brief explanation of the theme classification"
  }}
}}

CRITICAL REQUIREMENTS:
- Preserve ALL dandas (। and ॥) from the original verse in their exact positions in uncompounded_shloka
- Maintain the exact structure and formatting as the original
- Each uncompounded word should be separated by a space
- Include all words from the original shloka (no words should be missing)
- Use descriptive theme phrases (e.g., "Wisdom and Learning") rather than single words (e.g., "Wisdom")
- Themes should be clear, descriptive phrases that capture the essence of the subhashita
- Return ONLY valid JSON, no additional text or markdown formatting"""


def parse_json_response(response_text: str) -> Optional[Dict[str, Any]]:
    """
    Parse JSON from OpenAI response, handling code fences if present.
    
    Args:
        response_text: Raw response text from OpenAI
        
    Returns:
        Parsed JSON dictionary or None if parsing fails
    """
    if not response_text:
        return None
    
    # Remove code fences if present
    text = response_text.strip()
    
    # Try to extract JSON from code fences (non-greedy match for first occurrence)
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1)
    else:
        # Try to find JSON object in the text (match balanced braces)
        # Find the first { and then match to the last }
        brace_start = text.find('{')
        if brace_start != -1:
            brace_count = 0
            brace_end = -1
            for i in range(brace_start, len(text)):
                if text[i] == '{':
                    brace_count += 1
                elif text[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        brace_end = i
                        break
            if brace_end != -1:
                text = text[brace_start:brace_end + 1]
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to fix common issues - remove trailing commas, etc.
        # First try with minimal cleanup
        try:
            # Remove trailing commas before } or ]
            text = re.sub(r',(\s*[}\]])', r'\1', text)
            return json.loads(text)
        except json.JSONDecodeError:
            return None


def get_random_subhashitas(
    collection,
    count: int = 1000,
    force: bool = False
) -> List[Dict[str, Any]]:
    """
    Get random subhashitas from MongoDB using $sample aggregation.
    
    Args:
        collection: MongoDB collection object
        count: Number of random subhashitas to get (default: 1000)
        force: If False, filter out documents that already have translation_model field
        
    Returns:
        List of subhashita documents
    """
    # Build aggregation pipeline
    pipeline = []
    
    # Filter out already-translated subhashitas if not forcing
    if not force:
        pipeline.append({
            "$match": {
                "$or": [
                    {"translation_model": {"$exists": False}},
                    {"translation_model": None},
                    {"translation_model": ""}
                ]
            }
        })
    
    # Sample random documents
    pipeline.append({
        "$sample": {
            "size": count
        }
    })
    
    cursor = collection.aggregate(pipeline)
    subhashitas = list(cursor)
    return subhashitas


def translate_subhashita_with_openai(
    api_key: str,
    model: str,
    devanagari_text: str,
    verse_number: str
) -> Optional[Dict[str, Any]]:
    """
    Call OpenAI to translate a subhashita and get sandhi split and theme.
    
    Args:
        api_key: OpenAI API key
        model: OpenAI model to use (e.g., 'gpt-5.2')
        devanagari_text: Devanagari text of the subhashita
        verse_number: Verse number for context
        
    Returns:
        Dictionary with translation data or None if translation fails
    """
    user_prompt = USER_PROMPT_TEMPLATE.format(
        verse_number=verse_number,
        devanagari_text=devanagari_text
    )
    
    try:
        response_text = make_openai_request(
            api_key=api_key,
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            model=model,
            temperature=0.3,
            max_tokens=2000  # Increased for comprehensive responses
        )
        
        # Parse JSON response
        translation_data = parse_json_response(response_text)
        
        if not translation_data:
            return None
        
        # Validate required fields
        if not translation_data.get("full_translation"):
            return None
        if not translation_data.get("uncompounded_shloka"):
            return None
        if not translation_data.get("word_by_word_translation"):
            return None
        if not translation_data.get("theme"):
            return None
        
        return translation_data
        
    except Exception as e:
        print(f"    ⚠ Error calling OpenAI for verse {verse_number}: {e}")
        return None


def update_subhashita_in_db(
    collection,
    verse_number: str,
    translation_data: Dict[str, Any],
    model: str
) -> bool:
    """
    Update subhashita document in MongoDB with translation data.
    
    Args:
        collection: MongoDB collection object
        verse_number: Verse number to update
        translation_data: Dictionary with translation, split, and theme data
        model: Model name used for translation
        
    Returns:
        True if update successful, False otherwise
    """
    try:
        # Extract theme data
        theme_data = translation_data.get("theme", {})
        
        # Prepare update fields
        update_fields = {
            "full_translation": translation_data.get("full_translation", ""),
            "split_shloka": translation_data.get("uncompounded_shloka", ""),
            "split_word_by_word_translation": translation_data.get("word_by_word_translation", []),
            "primary_theme": theme_data.get("primary_theme", ""),
            "secondary_themes": theme_data.get("secondary_themes", []),
            "theme_rationale": theme_data.get("rationale", ""),
            "translation_model": model,
            "translated_at": datetime.utcnow()
        }
        
        # Update document
        result = collection.update_one(
            {"verse_number": verse_number},
            {"$set": update_fields}
        )
        
        return result.matched_count > 0
        
    except Exception as e:
        print(f"    ⚠ Error updating verse {verse_number} in DB: {e}")
        return False


def process_single_subhashita(
    subhashita: Dict[str, Any],
    collection,
    api_key: str,
    model: str,
    force: bool,
    index: int,
    total: int
) -> Dict[str, Any]:
    """
    Process a single subhashita: translate and update database.
    
    Returns:
        Dictionary with status: 'translated', 'skipped', or 'error'
    """
    verse_number = subhashita.get("verse_number", "")
    verse_id = subhashita.get("_id", "")
    
    # Check if already translated (idempotency check)
    if not force and subhashita.get("translation_model"):
        return {
            "status": "skipped",
            "verse_number": verse_number,
            "reason": f"already translated by {subhashita.get('translation_model')}",
            "index": index,
            "total": total
        }
    
    # Get devanagari text
    devanagari_text = subhashita.get("transliterated_devanagari") or subhashita.get("original_iast", "")
    if not devanagari_text:
        return {
            "status": "skipped",
            "verse_number": verse_number,
            "reason": "no text found",
            "index": index,
            "total": total
        }
    
    # Translate with OpenAI
    translation_data = translate_subhashita_with_openai(
        api_key=api_key,
        model=model,
        devanagari_text=devanagari_text,
        verse_number=verse_number
    )
    
    if not translation_data:
        return {
            "status": "error",
            "verse_number": verse_number,
            "reason": "translation failed",
            "index": index,
            "total": total
        }
    
    # Update database
    success = update_subhashita_in_db(
        collection=collection,
        verse_number=verse_number,
        translation_data=translation_data,
        model=model
    )
    
    if success:
        primary_theme = translation_data.get("theme", {}).get("primary_theme", "N/A")
        return {
            "status": "translated",
            "verse_number": verse_number,
            "primary_theme": primary_theme,
            "index": index,
            "total": total
        }
    else:
        return {
            "status": "error",
            "verse_number": verse_number,
            "reason": "database update failed",
            "index": index,
            "total": total
        }


def translate_subhashitas(
    mongodb_uri: str,
    database_name: str = 'subhashita',
    collection_name: str = 'mahasubhasitasamgraha',
    count: int = 1000,
    api_key: Optional[str] = None,
    model: str = 'gpt-5.2',
    delay: float = 1.0,
    force: bool = False,
    batch_size: int = 20
):
    """
    Main function to translate subhashitas using OpenAI.
    
    Args:
        mongodb_uri: MongoDB connection URI
        database_name: Database name (default: 'subhashita')
        collection_name: Collection name (default: 'mahasubhasitasamgraha')
        count: Number of random subhashitas to process (default: 1000)
        api_key: OpenAI API key (optional, uses env var if not provided)
        model: OpenAI model to use (default: 'gpt-5.2')
        delay: Delay between batches in seconds (default: 1.0)
        force: Re-translate already-translated subhashitas (default: False)
        batch_size: Number of subhashitas to process concurrently (default: 20)
    """
    print("Subhashita OpenAI Translation")
    print("=" * 60)
    print(f"Database: {database_name}")
    print(f"Collection: {collection_name}")
    print(f"Count: {count}")
    print(f"Model: {model}")
    print(f"Batch size: {batch_size} (concurrent)")
    print(f"Delay: {delay} seconds (between batches)")
    print(f"Force: {force}")
    print("=" * 60)
    
    # Get API key
    if not api_key:
        import os
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            print("Error: OPENAI_API_KEY must be provided or set as environment variable")
            return
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
        collection = db[collection_name]
    except ConnectionFailure as e:
        print(f"Error: {e}")
        return
    
    # Get random subhashitas
    print(f"\nGetting {count} random subhashitas...")
    
    # Count available documents if not forcing
    if not force:
        available_count = collection.count_documents({
            "$or": [
                {"translation_model": {"$exists": False}},
                {"translation_model": None},
                {"translation_model": ""}
            ]
        })
        if available_count < count:
            print(f"  Note: Only {available_count} untranslated subhashitas available (requested {count})")
    
    try:
        subhashitas = get_random_subhashitas(
            collection=collection,
            count=count,
            force=force
        )
    except Exception as e:
        print(f"Error getting random subhashitas: {e}")
        client.close()
        return
    
    if not subhashitas:
        print("No subhashitas found to process")
        client.close()
        return
    
    print(f"✓ Found {len(subhashitas)} subhashita(s) to process")
    print(f"Processing in batches of {batch_size} (concurrent)")
    print("=" * 60)
    
    # Process in batches
    totals = {
        "processed": 0,
        "translated": 0,
        "skipped": 0,
        "errors": 0
    }
    
    total_batches = (len(subhashitas) + batch_size - 1) // batch_size
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(subhashitas))
        batch = subhashitas[start_idx:end_idx]
        
        print(f"\nBatch {batch_num + 1}/{total_batches} ({len(batch)} subhashitas)...")
        
        # Process batch concurrently
        with ThreadPoolExecutor(max_workers=batch_size) as executor:
            # Submit all tasks in the batch
            future_to_subhashita = {
                executor.submit(
                    process_single_subhashita,
                    subhashita,
                    collection,
                    api_key,
                    model,
                    force,
                    start_idx + i + 1,
                    len(subhashitas)
                ): (subhashita, i)
                for i, subhashita in enumerate(batch)
            }
            
            # Process results as they complete
            for future in as_completed(future_to_subhashita):
                result = future.result()
                totals["processed"] += 1
                
                if result["status"] == "translated":
                    totals["translated"] += 1
                    print(f"  ✓ [{result['index']}/{result['total']}] {result['verse_number']} ({result['primary_theme']})")
                elif result["status"] == "skipped":
                    totals["skipped"] += 1
                    print(f"  ⊘ [{result['index']}/{result['total']}] {result['verse_number']} ({result['reason']})")
                else:
                    totals["errors"] += 1
                    print(f"  ✗ [{result['index']}/{result['total']}] {result['verse_number']} ({result['reason']})")
        
        # Delay between batches (not between individual items)
        if delay > 0 and batch_num < total_batches - 1:
            time.sleep(delay)
    
    # Final summary
    print(f"\n{'='*60}")
    print("Final Summary")
    print(f"{'='*60}")
    print(f"Total processed: {totals['processed']}")
    print(f"Total translated: {totals['translated']}")
    print(f"Total skipped: {totals['skipped']}")
    print(f"Total errors: {totals['errors']}")
    print(f"{'='*60}")
    
    client.close()
    print("\n✓ Translation complete!")


if __name__ == '__main__':
    # This script is typically called from command_processor.py
    # But can be used standalone with proper arguments
    import argparse
    import os
    
    parser = argparse.ArgumentParser(description='Translate subhashitas using OpenAI')
    parser.add_argument('--mongodb-uri', help='MongoDB connection URI', 
                       default=os.getenv('MONGODB_URI'))
    parser.add_argument('--database', help='Database name', 
                       default='subhashita')
    parser.add_argument('--collection', help='Collection name', 
                       default='mahasubhasitasamgraha')
    parser.add_argument('--count', type=int, default=1000, 
                       help='Number of random subhashitas to process')
    parser.add_argument('--api-key', help='OpenAI API key', 
                       default=os.getenv('OPENAI_API_KEY'))
    parser.add_argument('--model', default='gpt-5.2', help='OpenAI model to use')
    parser.add_argument('--delay', type=float, default=1.0, 
                       help='Delay between batches (seconds)')
    parser.add_argument('--force', action='store_true', 
                       help='Re-translate already-translated subhashitas')
    parser.add_argument('--batch-size', type=int, default=20,
                       help='Number of subhashitas to process concurrently (default: 20)')
    
    args = parser.parse_args()
    
    if not args.mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        exit(1)
    
    translate_subhashitas(
        mongodb_uri=args.mongodb_uri,
        database_name=args.database,
        collection_name=args.collection,
        count=args.count,
        api_key=args.api_key,
        model=args.model,
        delay=args.delay,
        force=args.force,
        batch_size=args.batch_size
    )

