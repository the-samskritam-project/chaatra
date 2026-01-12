#!/usr/bin/env python3
"""
Generate word-to-split-word mappings for Bhagavad Gita verses using LLM.

Reads verses from MongoDB chapter collections, uses LLM to create explicit
mappings from original words to split words, and stores them back in MongoDB.
"""

import json
import re
import time
from typing import List, Optional, Dict, Any, Tuple

try:
    from pymongo.errors import ConnectionFailure
except ImportError:
    ConnectionFailure = Exception

from processor.translators.api_client import make_openai_request, DEFAULT_MODEL
from processor.utils.mongodb_utils import connect_mongodb


# System prompt
SYSTEM_PROMPT = """You are an expert in Sanskrit grammar and sandhi (phonetic combination rules).
Your task is to create an explicit mapping from original words in a shloka to the split words
in the uncompounded version of the shloka."""


def discover_chapter_collections(db) -> List[int]:
    """
    Discover all chapter collections matching pattern chapter_\d+.
    
    Args:
        db: MongoDB database object
        
    Returns:
        List of chapter numbers (integers)
    """
    collections = db.list_collection_names()
    chapter_numbers = []
    
    for coll_name in collections:
        match = re.match(r'^chapter_(\d+)$', coll_name)
        if match:
            chapter_num = int(match.group(1))
            chapter_numbers.append(chapter_num)
    
    return sorted(chapter_numbers)


def split_devanagari_words(text: str) -> List[str]:
    """
    Split Devanagari text into individual words, excluding dandas.
    
    Matches the frontend logic: split by whitespace and filter out words that are only dandas.
    
    Args:
        text: Devanagari text string
        
    Returns:
        List of words (excluding dandas-only words)
    """
    if not text:
        return []
    
    # Remove extra whitespace
    text = text.strip()
    
    # Split by whitespace (matches frontend: split(/\s+/))
    words = text.split()
    
    # Filter out empty strings and words that are only dandas (matches frontend filter)
    filtered_words = []
    for word in words:
        word = word.strip()
        if word and not re.match(r'^[।॥]+$', word):
            filtered_words.append(word)
    
    return filtered_words


def parse_json_response(response_text: str) -> Optional[Dict[str, Any]]:
    """
    Parse JSON from LLM response, handling code fences if present.
    
    Args:
        response_text: Raw response text from LLM
        
    Returns:
        Parsed JSON dictionary or None if parsing fails
    """
    if not response_text:
        return None
    
    # Remove code fences if present
    text = response_text.strip()
    
    # Try to extract JSON from code fences
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1)
    else:
        # Try to find JSON object in the text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            text = json_match.group(0)
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to fix common issues
        text = text.replace('\n', ' ').replace('\r', ' ')
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None


def generate_word_mappings_batch(
    api_key: str,
    shlokas: List[Tuple[str, str, str]],  # List of (verse_number, original_shloka, split_shloka)
    model: str = DEFAULT_MODEL
) -> List[Tuple[Optional[Dict[str, List[str]]], Optional[str]]]:
    """
    Generate word-to-split-word mappings for multiple shlokas in a single LLM call.
    
    Args:
        api_key: OpenAI API key
        shlokas: List of tuples (verse_number, original_shloka, split_shloka)
        model: OpenAI model to use
        
    Returns:
        List of tuples (mapping, error_msg), one per shloka.
        - mapping: dict {original_word: [split_word1, split_word2, ...]} or None if failed
        - error_msg: str with reason for failure, or None if successful
    """
    if not shlokas:
        return []
    
    # Build prompt with all shlokas
    shloka_sections = []
    for idx, (verse_number, original_shloka, split_shloka) in enumerate(shlokas):
        original_words = split_devanagari_words(original_shloka)
        split_words = split_devanagari_words(split_shloka)
        
        if not original_words or not split_words:
            continue
        
        shloka_sections.append(f"""
Shloka {idx + 1} (Verse {verse_number}):
Original Shloka (in Devanagari):
{original_shloka}

Split Shloka (uncompounded, in Devanagari):
{split_shloka}

Original Words:
{chr(10).join(f'- {word}' for word in original_words)}

Split Words:
{chr(10).join(f'- {word}' for word in split_words)}
""")
    
    if not shloka_sections:
        return [None] * len(shlokas)
    
    user_prompt = f"""Given {len(shlokas)} original Sanskrit shlokas and their uncompounded (split) versions, create explicit mappings from original compound words to their split sub-words for each shloka.

{''.join(shloka_sections)}

Task:
For each shloka, create a mapping that shows which original compound word maps to which split sub-words. 
Each original word may map to one or more split words (when a compound word is split into sub-words).

Return your response as a JSON object with the following structure:
{{
  "shloka_0": {{
    "कर्मण्येव": ["कर्मणि", "एव"],      // Compound word "कर्मण्येव" maps to split words ["कर्मणि", "एव"]
    "अधिकारः": ["अधिकारः"],            // Simple word "अधिकारः" maps to itself
    "ते": ["ते"]                         // Simple word "ते" maps to itself
  }},
  "shloka_1": {{
    "word1": ["sub", "word", "1"],
    "word2": ["word2"]
  }},
  ...
}}

CRITICAL REQUIREMENTS:
- Use keys "shloka_0", "shloka_1", ..., "shloka_{len(shlokas) - 1}" for each shloka
- For each shloka, keys must be the actual original word (compound word) as it appears in the original shloka
- Values must be arrays of actual split words (sub-words) as they appear in the split shloka
- All original words must be present as keys
- All split words must appear in the values (each split word should appear exactly once across all mappings)
- Use the exact words as they appear in the shlokas (preserve Devanagari script exactly)
- Return ONLY valid JSON, no additional text or markdown formatting

JSON Response:"""
    
    try:
        response_text = make_openai_request(
            api_key=api_key,
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            model=model,
            temperature=0.3,
            max_tokens=8000  # Increased for batch processing
        )
        
        # Parse JSON response
        batch_mapping_data = parse_json_response(response_text)
        
        if not batch_mapping_data:
            return [(None, "Failed to parse JSON response")] * len(shlokas)
        
        # Extract mappings for each shloka
        results = []
        for idx in range(len(shlokas)):
            verse_number, original_shloka, split_shloka = shlokas[idx]
            key = f"shloka_{idx}"
            
            if key not in batch_mapping_data:
                results.append((None, f"Missing key '{key}' in LLM response"))
                continue
            
            mapping_data = batch_mapping_data[key]
            
            if not isinstance(mapping_data, dict):
                results.append((None, f"Expected dict, got {type(mapping_data)}"))
                continue
            
            # Just parse the LLM response - trust it
            validated_mapping = {}
            for original_word, split_word_list in mapping_data.items():
                # Ensure split_word_list is a list
                if not isinstance(split_word_list, list):
                    continue
                
                # Convert to strings, no validation
                validated_mapping[original_word] = [str(word).strip() for word in split_word_list if str(word).strip()]
            
            # If we got any mappings, use them
            if validated_mapping:
                results.append((validated_mapping, None))
            else:
                results.append((None, "No valid mappings found in response"))
        
        return results
        
    except Exception as e:
        import traceback
        error_msg = f"Exception: {str(e)}"
        print(f"    ⚠ Error generating batch mapping: {e}")
        return [(None, error_msg)] * len(shlokas)


def generate_word_mapping(
    api_key: str,
    original_shloka: str,
    split_shloka: str,
    model: str = DEFAULT_MODEL
) -> Optional[Dict[str, List[str]]]:
    """
    Generate word-to-split-word mapping using LLM (single shloka).
    
    Args:
        api_key: OpenAI API key
        original_shloka: Original shloka in Devanagari
        split_shloka: Split (uncompounded) shloka in Devanagari
        model: OpenAI model to use
        
    Returns:
        Dictionary mapping original words to lists of split words,
        or None if generation fails.
        Format: {original_word: [split_word1, split_word2, ...]}
    """
    # Use batch function with single shloka
    result = generate_word_mappings_batch(
        api_key=api_key,
        shlokas=[("", original_shloka, split_shloka)],
        model=model
    )
    
    if result and len(result) > 0:
        mapping, error_msg = result[0]
        return mapping
    return None


def generate_word_mappings(
    mongodb_uri: str,
    database_name: str = 'bhagavad_gita_shankara_bhasya',
    api_key: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    start_chapter: Optional[int] = None,
    end_chapter: Optional[int] = None,
    skip_existing: bool = False,
    delay: float = 1.0,
    batch_size: int = 10
):
    """
    Generate word-to-split-word mappings for all Bhagavad Gita verses.
    
    Args:
        mongodb_uri: MongoDB connection string
        database_name: Name of the database (defaults to bhagavad_gita_shankara_bhasya)
        api_key: OpenAI API key (required)
        model: OpenAI model to use (default: gpt-4o)
        start_chapter: First chapter to process (None = all chapters)
        end_chapter: Last chapter to process (None = all chapters)
        skip_existing: Skip documents that already have word_to_split_mapping (default: False)
        delay: Delay between batches in seconds (default: 1.0)
        batch_size: Number of documents to process per batch (default: 10)
    """
    if not api_key:
        raise ValueError("api_key is required")
    
    print("Bhagavad Gita Word Mapping Generation")
    print("=" * 60)
    print(f"Database: {database_name}")
    if start_chapter or end_chapter:
        print(f"Chapter range: {start_chapter or 1} - {end_chapter or 'end'}")
    else:
        print("Chapter range: All chapters")
    print(f"Model: {model}")
    print(f"Batch size: {batch_size}")
    print(f"Delay between batches: {delay} seconds")
    print(f"Skip existing: {skip_existing}")
    print("=" * 60)
    
    # Connect to MongoDB
    print(f"\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
    except ConnectionFailure as e:
        print(f"Error: {e}")
        return
    
    # Discover chapter collections
    print(f"\nDiscovering chapter collections...")
    chapter_numbers = discover_chapter_collections(db)
    
    if not chapter_numbers:
        print("Error: No chapter collections found (expected pattern: chapter_N)")
        client.close()
        return
    
    # Filter chapters by range
    if start_chapter is not None:
        chapter_numbers = [ch for ch in chapter_numbers if ch >= start_chapter]
    if end_chapter is not None:
        chapter_numbers = [ch for ch in chapter_numbers if ch <= end_chapter]
    
    if not chapter_numbers:
        print(f"No chapters found in range {start_chapter}-{end_chapter}")
        client.close()
        return
    
    print(f"✓ Found {len(chapter_numbers)} chapter(s) to process")
    
    # Process each chapter
    totals = {
        "processed": 0,
        "mapped": 0,
        "skipped": 0,
        "errors": 0
    }
    
    for chapter_num in chapter_numbers:
        collection_name = f"chapter_{chapter_num}"
        collection = db[collection_name]
        
        print(f"\nChapter {chapter_num} ({collection_name})")
        print("-" * 60)
        
        # Find all documents with both transliterated_devanagari and split_shloka
        query = {
            'transliterated_devanagari': {'$exists': True, '$ne': ''},
            'split_shloka': {'$exists': True, '$ne': ''}
        }
        
        if skip_existing:
            query['word_to_split_mapping'] = {'$exists': False}
        
        cursor = collection.find(query).sort('verse_index', 1)
        documents = list(cursor)
        
        if not documents:
            print(f"  No documents found with both transliterated_devanagari and split_shloka")
            continue
        
        print(f"  Found {len(documents)} document(s)")
        
        chapter_totals = {
            "processed": 0,
            "mapped": 0,
            "skipped": 0,
            "errors": 0
        }
        
        # Process documents in batches
        total_batches = (len(documents) + batch_size - 1) // batch_size
        
        for batch_idx in range(0, len(documents), batch_size):
            batch = documents[batch_idx:batch_idx + batch_size]
            batch_num = (batch_idx // batch_size) + 1
            
            print(f"  Processing batch {batch_num}/{total_batches} ({len(batch)} documents)...")
            
            # Prepare batch data
            batch_data = []
            batch_docs = []
            
            for doc in batch:
                chapter_totals["processed"] += 1
                totals["processed"] += 1
                
                doc_id = doc.get("_id", "")
                verse_number = doc.get("verse_number", doc_id)
                
                # Skip if already has mapping and skip_existing is True
                if skip_existing and doc.get("word_to_split_mapping"):
                    chapter_totals["skipped"] += 1
                    totals["skipped"] += 1
                    continue
                
                original_shloka = doc.get("transliterated_devanagari", "")
                split_shloka = doc.get("split_shloka", "")
                
                if not original_shloka or not split_shloka:
                    chapter_totals["skipped"] += 1
                    totals["skipped"] += 1
                    continue
                
                batch_data.append((verse_number, original_shloka, split_shloka))
                batch_docs.append((doc_id, verse_number))
            
            if not batch_data:
                continue
            
            # Generate mappings for entire batch in one LLM call
            print(f"    Calling LLM for {len(batch_data)} shlokas...", end=" ", flush=True)
            mappings = generate_word_mappings_batch(
                api_key=api_key,
                shlokas=batch_data,
                model=model
            )
            
            # Update documents with mappings
            for (doc_id, verse_number), result in zip(batch_docs, mappings):
                # Handle both old format (just mapping) and new format (tuple with error)
                if isinstance(result, tuple):
                    mapping, error_msg = result
                else:
                    mapping, error_msg = result, None
                
                if mapping:
                    try:
                        collection.update_one(
                            {'_id': doc_id},
                            {'$set': {'word_to_split_mapping': mapping}}
                        )
                        chapter_totals["mapped"] += 1
                        totals["mapped"] += 1
                    except Exception as e:
                        print(f"\n    ✗ Error updating {verse_number}: {e}")
                        chapter_totals["errors"] += 1
                        totals["errors"] += 1
                else:
                    error_detail = f" - {error_msg}" if error_msg else ""
                    print(f"\n    ✗ Failed to generate mapping for {verse_number}{error_detail}")
                    chapter_totals["errors"] += 1
                    totals["errors"] += 1
            
            # Print success count
            success_count = sum(1 for m in mappings if m is not None)
            print(f"✓ ({success_count}/{len(batch_data)} successful)")
            
            # Add delay between batches (not between individual documents)
            if delay > 0 and batch_num < total_batches:
                time.sleep(delay)
        
        print(f"  Chapter {chapter_num} summary: {chapter_totals['mapped']} mapped, "
              f"{chapter_totals['skipped']} skipped, {chapter_totals['errors']} errors")
    
    # Print final summary
    print("\n" + "=" * 60)
    print("Final Summary")
    print("=" * 60)
    print(f"Total processed: {totals['processed']}")
    print(f"Total mapped: {totals['mapped']}")
    print(f"Total skipped: {totals['skipped']}")
    print(f"Total errors: {totals['errors']}")
    print("=" * 60)
    
    client.close()
    print("\n✓ Word mapping generation complete")
