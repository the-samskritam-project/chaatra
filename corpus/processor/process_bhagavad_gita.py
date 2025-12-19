#!/usr/bin/env python3
"""
Process Bhagavad Gita verses by calling Go HTTP endpoints for splits and translations.

Fetches verses from the API and processes them one at a time to avoid rate limits.
"""

import os
import sys
import time
from typing import Optional, Dict, List

try:
    import requests
except ImportError:
    print("Error: requests library not found. Install with: pip install requests")
    sys.exit(1)


def process_bhagavad_gita_verses(
    api_base_url: str,
    start_chapter: Optional[int] = None,
    end_chapter: Optional[int] = None,
    delay: float = 0.5
) -> Dict[str, int]:
    """
    Process Bhagavad Gita verses by calling split and translate endpoints.
    
    Args:
        api_base_url: Base URL for the API (e.g., http://localhost:8081)
        start_chapter: First chapter to process (None = all chapters)
        end_chapter: Last chapter to process (None = all chapters)
        delay: Delay between API calls in seconds (default: 0.5)
        
    Returns:
        Dictionary with statistics: {
            'total_verses': int,
            'verses_split': int,
            'verses_translated': int,
            'verses_skipped_split': int,
            'verses_skipped_translation': int,
            'errors': int
        }
    """
    stats = {
        'total_verses': 0,
        'verses_split': 0,
        'verses_translated': 0,
        'verses_skipped_split': 0,
        'verses_skipped_translation': 0,
        'errors': 0
    }
    
    print("Bhagavad Gita Batch Processing")
    print("=" * 60)
    print(f"API Base URL: {api_base_url}")
    if start_chapter or end_chapter:
        print(f"Chapter Range: {start_chapter or 1} - {end_chapter or 'end'}")
    else:
        print("Chapter Range: All chapters")
    print(f"Delay between calls: {delay} seconds")
    print("=" * 60)
    print()
    
    # Fetch chapters
    try:
        chapters_response = requests.get(f"{api_base_url}/v2/bhagavad_gita/chapters", timeout=30)
        chapters_response.raise_for_status()
        chapters = chapters_response.json()
    except requests.exceptions.ConnectionError as e:
        print(f"Error: Could not connect to API at {api_base_url}")
        print(f"  Details: {e}")
        print(f"\n  Make sure the Go backend server is running on {api_base_url}")
        sys.exit(1)
    except requests.exceptions.Timeout as e:
        print(f"Error: Request to {api_base_url} timed out")
        print(f"  Details: {e}")
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        print(f"Error: HTTP error from API: {e}")
        if hasattr(e.response, 'status_code'):
            print(f"  Status code: {e.response.status_code}")
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"Error fetching chapters: {e}")
        sys.exit(1)
    
    if not isinstance(chapters, list):
        print(f"Error: Expected list of chapters, got {type(chapters)}")
        sys.exit(1)
    
    # Filter chapters by range
    filtered_chapters = []
    for chapter in chapters:
        chapter_num = chapter.get('chapter_number')
        if chapter_num is None:
            continue
        
        if start_chapter is not None and chapter_num < start_chapter:
            continue
        if end_chapter is not None and chapter_num > end_chapter:
            continue
        
        filtered_chapters.append(chapter)
    
    filtered_chapters.sort(key=lambda x: x.get('chapter_number', 0))
    
    print(f"Processing {len(filtered_chapters)} chapter(s)...")
    print()
    
    # Process each chapter
    for chapter in filtered_chapters:
        chapter_num = chapter.get('chapter_number')
        verse_count = chapter.get('verse_count', 0)
        
        print(f"Chapter {chapter_num} ({verse_count} verses)")
        print("-" * 60)
        
        # Fetch verses for this chapter
        try:
            verses_response = requests.get(
                f"{api_base_url}/v2/bhagavad_gita/verses?chapter={chapter_num}",
                timeout=30
            )
            verses_response.raise_for_status()
            verses = verses_response.json()
        except requests.exceptions.ConnectionError as e:
            print(f"  ✗ Error: Could not connect to API at {api_base_url}")
            print(f"    Details: {e}")
            stats['errors'] += 1
            continue
        except requests.exceptions.RequestException as e:
            print(f"  ✗ Error fetching verses for chapter {chapter_num}: {e}")
            stats['errors'] += 1
            continue
        
        if not isinstance(verses, list):
            print(f"  ✗ Error: Expected list of verses, got {type(verses)}")
            stats['errors'] += 1
            continue
        
        # Filter to only original_verse type
        original_verses = [v for v in verses if v.get('type') == 'original_verse']
        
        print(f"  Found {len(original_verses)} verse(s) to process")
        
        # Process each verse
        for verse in original_verses:
            verse_number = verse.get('verse_number')
            if not verse_number:
                continue
            
            stats['total_verses'] += 1
            has_split = bool(verse.get('split_shloka'))
            has_translation = bool(verse.get('full_translation'))
            
            print(f"  Verse {verse_number}: ", end='', flush=True)
            
            # Process split if needed
            if not has_split:
                try:
                    split_response = requests.post(
                        f"{api_base_url}/v2/bhagavad_gita/verses/{verse_number}/split",
                        timeout=60,
                        headers={'Content-Type': 'application/json'}
                    )
                    split_response.raise_for_status()
                    stats['verses_split'] += 1
                    print("✓ Split ", end='', flush=True)
                    time.sleep(delay)
                except requests.exceptions.ConnectionError as e:
                    print(f"✗ Split failed (connection error): {e} ", end='', flush=True)
                    stats['errors'] += 1
                    # Continue to translation even if split failed
                except requests.exceptions.RequestException as e:
                    print(f"✗ Split failed: {e} ", end='', flush=True)
                    stats['errors'] += 1
                    # Continue to translation even if split failed
            else:
                stats['verses_skipped_split'] += 1
                print("⊘ Split (already exists) ", end='', flush=True)
            
            # Process translation if needed
            if not has_translation:
                try:
                    translate_response = requests.post(
                        f"{api_base_url}/v2/bhagavad_gita/verses/{verse_number}/translate",
                        timeout=60,
                        headers={'Content-Type': 'application/json'}
                    )
                    translate_response.raise_for_status()
                    stats['verses_translated'] += 1
                    print("✓ Translated", flush=True)
                    time.sleep(delay)
                except requests.exceptions.ConnectionError as e:
                    print(f"✗ Translation failed (connection error): {e}", flush=True)
                    stats['errors'] += 1
                except requests.exceptions.RequestException as e:
                    print(f"✗ Translation failed: {e}", flush=True)
                    stats['errors'] += 1
            else:
                stats['verses_skipped_translation'] += 1
                print("⊘ Translation (already exists)", flush=True)
        
        print()
    
    # Print summary
    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total verses processed: {stats['total_verses']}")
    print(f"Verses split: {stats['verses_split']}")
    print(f"Verses translated: {stats['verses_translated']}")
    print(f"Verses skipped (split already exists): {stats['verses_skipped_split']}")
    print(f"Verses skipped (translation already exists): {stats['verses_skipped_translation']}")
    print(f"Errors encountered: {stats['errors']}")
    print("=" * 60)
    
    return stats
