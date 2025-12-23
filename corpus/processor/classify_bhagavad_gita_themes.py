#!/usr/bin/env python3
"""
Classify Bhagavad Gita verses into philosophical themes using LangChain + OpenAI.

Reads verses from MongoDB chapter collections, calls OpenAI to classify each verse
into predefined themes, and stores the classification back in MongoDB.
"""

import json
import re
import time
from datetime import datetime
from typing import List, Optional, Dict, Any

try:
    from pymongo.errors import ConnectionFailure
    from pymongo import UpdateOne
except ImportError:
    ConnectionFailure = Exception  # Fallback type hint if pymongo not installed
    UpdateOne = None  # type: ignore

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from processor.classification.llm_client import build_llm
from processor.utils.mongodb_utils import connect_mongodb

# System prompt (static)
SYSTEM_PROMPT = """You are a Sanskrit philosophy scholar specializing in the Bhagavad Gita.
Your task is to classify verses into predefined philosophical themes.
You must only use the provided theme list.
A verse may belong to multiple themes.
Choose the most central theme as Primary.
Be precise, conservative, and consistent."""

# User prompt template
USER_PROMPT_TEMPLATE = """Verse:
Chapter: {chapter}
Verse: {verse_number}
Text (IAST or Devanagari):
{text}

Available Themes:
1. Karma Yoga – action, duty, right action
2. Jnana Yoga – knowledge, self, discernment
3. Bhakti Yoga – devotion, surrender, love
4. Dhyana Yoga – meditation, mind control
5. Sankhya / Metaphysics – prakriti, purusha, gunas
6. Psychology of the Mind – desire, fear, attachment
7. Ethics & Dharma – right/wrong, social duty
8. Renunciation & Detachment
9. Divine Nature – Ishvara, cosmic form, grace
10. Liberation – moksha, immortality
11. Pedagogy – teaching context, Arjuna's confusion

Task:
1. Select ONE Primary Theme
2. Select up to THREE Secondary Themes
3. Briefly explain your choice (2–3 sentences)

Return JSON in the following format:
{{
  "primary_theme": "...",
  "secondary_themes": ["...", "..."],
  "rationale": "..."
}}"""


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


def classify_verse_theme(llm: ChatOpenAI, chapter: int, verse_number: str, text: str) -> Optional[Dict[str, Any]]:
    """
    Classify a verse into themes using OpenAI.
    
    Args:
        llm: LangChain ChatOpenAI instance
        chapter: Chapter number
        verse_number: Verse number (e.g., "10.3")
        text: Verse text (IAST or Devanagari)
        
    Returns:
        Dictionary with primary_theme, secondary_themes, and rationale, or None if classification fails
    """
    user_prompt = USER_PROMPT_TEMPLATE.format(
        chapter=chapter,
        verse_number=verse_number,
        text=text
    )
    
    # Use system and user messages
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt)
    ]
    
    try:
        response = llm.invoke(messages)
        content = getattr(response, "content", "") or ""
        
        # Parse JSON response
        theme_data = parse_json_response(content)
        
        if not theme_data:
            return None
        
        # Validate required fields
        if not theme_data.get("primary_theme"):
            return None
        
        # Ensure secondary_themes is a list
        secondary_themes = theme_data.get("secondary_themes", [])
        if not isinstance(secondary_themes, list):
            secondary_themes = []
        
        return {
            "primary_theme": theme_data["primary_theme"],
            "secondary_themes": secondary_themes[:3],  # Limit to 3
            "rationale": theme_data.get("rationale", "")
        }
    except Exception as e:
        print(f"    ⚠ Error classifying verse {verse_number}: {e}")
        return None


def classify_bhagavad_gita_themes(
    mongodb_uri: str,
    database_name: str = 'bhagavad_gita_shankara_bhasya',
    start_chapter: Optional[int] = None,
    end_chapter: Optional[int] = None,
    api_key: Optional[str] = None,
    model: str = "gpt-5.1",
    delay: float = 1.0,
    force: bool = False
):
    """
    Classify Bhagavad Gita verses into philosophical themes.
    
    Args:
        mongodb_uri: MongoDB connection string
        database_name: Name of the database (defaults to bhagavad_gita_shankara_bhasya)
        start_chapter: First chapter to process (None = all chapters)
        end_chapter: Last chapter to process (None = all chapters)
        api_key: OpenAI API key (optional, uses env vars if not provided)
        model: OpenAI model to use (default: gpt-5.1)
        delay: Delay between API calls in seconds (default: 1.0)
        force: Overwrite existing theme classifications (default: False)
    """
    print("Bhagavad Gita Theme Classification")
    print("=" * 60)
    print(f"Database: {database_name}")
    if start_chapter or end_chapter:
        print(f"Chapter range: {start_chapter or 1} - {end_chapter or 'end'}")
    else:
        print("Chapter range: All chapters")
    print(f"Model: {model}")
    print(f"Delay: {delay} seconds")
    print(f"Force: {force}")
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
    
    # Initialize LLM
    print(f"\nInitializing OpenAI model: {model}")
    try:
        llm = build_llm(model=model, api_key=api_key)
    except Exception as e:
        print(f"Error initializing LLM: {e}")
        client.close()
        return
    
    # Process each chapter
    totals = {
        "processed": 0,
        "classified": 0,
        "skipped": 0,
        "errors": 0
    }
    
    for chapter_num in chapter_numbers:
        collection_name = f"chapter_{chapter_num}"
        collection = db[collection_name]
        
        print(f"\nChapter {chapter_num} ({collection_name})")
        print("-" * 60)
        
        # Find all original_verse documents
        cursor = collection.find({'type': 'original_verse'}).sort('verse_index', 1)
        verses = list(cursor)
        
        if not verses:
            print(f"  No verses found in {collection_name}")
            continue
        
        print(f"  Found {len(verses)} verse(s)")
        
        chapter_totals = {
            "processed": 0,
            "classified": 0,
            "skipped": 0,
            "errors": 0
        }
        
        pending_ops: List = []
        
        for verse in verses:
            chapter_totals["processed"] += 1
            totals["processed"] += 1
            
            verse_number = verse.get("verse_number", "")
            verse_id = verse.get("_id", "")
            
            # Skip if already has themes and not forcing
            if not force and verse.get("primary_theme"):
                chapter_totals["skipped"] += 1
                totals["skipped"] += 1
                print(f"  ⊘ {verse_number} (already classified)")
                continue
            
            # Extract text: prefer original_iast, fallback to transliterated_devanagari
            text = verse.get("original_iast") or verse.get("transliterated_devanagari")
            
            if not text:
                chapter_totals["skipped"] += 1
                totals["skipped"] += 1
                print(f"  ⊘ {verse_number} (no text found)")
                continue
            
            # Classify verse
            print(f"  → {verse_number}...", end=" ", flush=True)
            theme_data = classify_verse_theme(
                llm=llm,
                chapter=chapter_num,
                verse_number=verse_number,
                text=text
            )
            
            if not theme_data:
                chapter_totals["errors"] += 1
                totals["errors"] += 1
                print("✗ (classification failed)")
                continue
            
            # Prepare update
            update_fields = {
                "primary_theme": theme_data["primary_theme"],
                "secondary_themes": theme_data["secondary_themes"],
                "rationale": theme_data["rationale"],
                "theme_classification_model": model,
                "theme_classified_at": datetime.utcnow()
            }
            
            if UpdateOne:
                pending_ops.append(
                    UpdateOne(
                        {"_id": verse_id},
                        {"$set": update_fields}
                    )
                )
            else:
                # Fallback to direct update
                collection.update_one(
                    {"_id": verse_id},
                    {"$set": update_fields}
                )
            
            chapter_totals["classified"] += 1
            totals["classified"] += 1
            print(f"✓ {theme_data['primary_theme']}")
            
            # Batch write every 10 verses
            if UpdateOne and len(pending_ops) >= 10:
                try:
                    collection.bulk_write(pending_ops, ordered=False)
                    pending_ops = []
                except Exception as e:
                    print(f"    ⚠ Batch write error: {e}")
            
            # Delay between API calls
            if delay > 0:
                time.sleep(delay)
        
        # Flush remaining updates
        if UpdateOne and pending_ops:
            try:
                collection.bulk_write(pending_ops, ordered=False)
            except Exception as e:
                print(f"    ⚠ Final batch write error: {e}")
        
        print(f"\n  Chapter {chapter_num} summary: "
              f"processed={chapter_totals['processed']}, "
              f"classified={chapter_totals['classified']}, "
              f"skipped={chapter_totals['skipped']}, "
              f"errors={chapter_totals['errors']}")
    
    # Final summary
    print(f"\n{'='*60}")
    print("Final Summary")
    print(f"{'='*60}")
    print(f"Total processed: {totals['processed']}")
    print(f"Total classified: {totals['classified']}")
    print(f"Total skipped: {totals['skipped']}")
    print(f"Total errors: {totals['errors']}")
    print(f"{'='*60}")
    
    client.close()
    print("\n✓ Theme classification complete!")


if __name__ == '__main__':
    # This script is typically called from command_processor.py
    # But can be used standalone with proper arguments
    import argparse
    import os
    
    parser = argparse.ArgumentParser(description='Classify Bhagavad Gita verses into themes')
    parser.add_argument('--mongodb-uri', help='MongoDB connection URI', 
                       default=os.getenv('MONGODB_URI'))
    parser.add_argument('--database', help='Database name', 
                       default='bhagavad_gita_shankara_bhasya')
    parser.add_argument('--start-chapter', type=int, help='First chapter to process')
    parser.add_argument('--end-chapter', type=int, help='Last chapter to process')
    parser.add_argument('--api-key', help='OpenAI API key', 
                       default=os.getenv('OPENAI_API_KEY') or os.getenv('LANGCHAIN_API_KEY'))
    parser.add_argument('--model', default='gpt-5.1', help='OpenAI model to use')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay between API calls (seconds)')
    parser.add_argument('--force', action='store_true', help='Overwrite existing themes')
    
    args = parser.parse_args()
    
    if not args.mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        exit(1)
    
    classify_bhagavad_gita_themes(
        mongodb_uri=args.mongodb_uri,
        database_name=args.database,
        start_chapter=args.start_chapter,
        end_chapter=args.end_chapter,
        api_key=args.api_key,
        model=args.model,
        delay=args.delay,
        force=args.force
    )

