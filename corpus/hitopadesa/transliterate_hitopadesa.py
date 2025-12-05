#!/usr/bin/env python3
"""
Transliterate Hitopadesa XML from IAST to Devanagari.

Extracts verses and prose from the XML file and outputs JSON with verse numbers,
prose numbers, original IAST text, and Devanagari transliteration.
"""

import xml.etree.ElementTree as ET
import json
import re
from typing import List, Dict, Optional

from transliterators.iast import iast_to_devanagari


def extract_verse_number(text: str) -> Optional[str]:
    """
    Extract verse number from text pattern like '// Hit_0.1 //'
    
    Args:
        text: Text containing verse number marker
        
    Returns:
        Verse number string (e.g., "0.1") or None
    """
    match = re.search(r'//\s*Hit_(\d+\.\d+)\s*//', text)
    if match:
        return match.group(1)
    return None


def get_chapter_from_verse_number(verse_number: str) -> Optional[int]:
    """
    Extract chapter number from verse number.
    
    Args:
        verse_number: Verse number string (e.g., "0.1", "2.146")
        
    Returns:
        Chapter number as integer or None
    """
    if not verse_number:
        return None
    try:
        chapter = int(verse_number.split('.')[0])
        return chapter
    except (ValueError, IndexError):
        return None


def clean_verse_text(text: str) -> str:
    """
    Remove verse number markers and clean up text.
    
    Args:
        text: Verse text with markers
        
    Returns:
        Cleaned verse text
    """
    # Remove verse number markers
    text = re.sub(r'//\s*Hit_\d+\.\d+\s*//', '', text)
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


def parse_hitopadesa_xml(xml_path: str) -> List[Dict[str, str]]:
    """
    Parse Hitopadesa XML and extract verses and prose in order.
    
    Args:
        xml_path: Path to the XML file
        
    Returns:
        List of dictionaries containing verses and prose in order
    """
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    # Define namespace
    ns = {'tei': 'http://www.tei-c.org/ns/1.0'}
    
    # Find the body element
    body = root.find('.//tei:body', ns)
    if body is None:
        # Try without namespace
        body = root.find('.//body')
    
    if body is None:
        raise ValueError("Could not find body element in XML")
    
    all_items = []
    
    # Track current chapter and prose counter per chapter
    current_chapter = None
    prose_counters = {}  # chapter -> counter
    
    # Iterate through all direct children of body in order
    for elem in body:
        tag = elem.tag
        # Remove namespace prefix if present
        if '}' in tag:
            tag = tag.split('}')[1]
        
        # Process verse (lg element)
        if tag == 'lg':
            # Get all line elements (l)
            l_elements = elem.findall('.//tei:l', ns) if elem.findall('.//tei:l', ns) else elem.findall('.//l')
            
            if not l_elements:
                continue
            
            # Combine all lines to form the complete verse
            verse_lines = []
            verse_number = None
            
            for l_elem in l_elements:
                line_text = (l_elem.text or '').strip()
                if line_text:
                    verse_lines.append(line_text)
                    # Check for verse number in this line
                    if verse_number is None:
                        verse_number = extract_verse_number(line_text)
            
            if not verse_lines:
                continue
            
            # Join lines with newline
            full_verse = '\n'.join(verse_lines)
            
            # Clean the verse text (remove verse number markers)
            clean_verse = clean_verse_text(full_verse)
            
            # Skip if no verse number found
            if verse_number is None:
                # Try to extract from the full text
                verse_number = extract_verse_number(full_verse)
                if verse_number:
                    clean_verse = clean_verse_text(full_verse)
            
            if verse_number:
                # Update current chapter
                chapter = get_chapter_from_verse_number(verse_number)
                if chapter is not None:
                    current_chapter = chapter
                
                # Transliterate to Devanagari
                devanagari = iast_to_devanagari(clean_verse)
                
                all_items.append({
                    'type': 'verse',
                    'verse_number': verse_number,
                    'original_iast': clean_verse,
                    'transliterated_devanagari': devanagari
                })
        
        # Process prose (p element)
        elif tag == 'p':
            prose_text = (elem.text or '').strip()
            
            # Skip empty prose
            if not prose_text:
                continue
            
            # Skip titles and markers
            if is_prose_title_or_marker(prose_text):
                continue
            
            # Only add prose if we have a current chapter
            if current_chapter is not None:
                # Initialize counter for this chapter if needed
                if current_chapter not in prose_counters:
                    prose_counters[current_chapter] = 0
                
                # Increment counter for this chapter
                prose_counters[current_chapter] += 1
                prose_number = f"{current_chapter}.{prose_counters[current_chapter]}"
                
                # Clean prose text
                clean_prose = clean_prose_text(prose_text)
                
                # Transliterate to Devanagari
                devanagari = iast_to_devanagari(clean_prose)
                
                all_items.append({
                    'type': 'prose',
                    'prose_number': prose_number,
                    'chapter_number': current_chapter,
                    'original_iast': clean_prose,
                    'transliterated_devanagari': devanagari
                })
    
    return all_items


def main():
    """Main function to process XML and generate JSON output."""
    xml_path = '../hitopadesa/hitopadesa.xml'
    output_path = 'hitopadesa_verses.json'
    
    print(f"Parsing {xml_path}...")
    all_items = parse_hitopadesa_xml(xml_path)
    
    verse_count = sum(1 for item in all_items if item['type'] == 'verse')
    prose_count = sum(1 for item in all_items if item['type'] == 'prose')
    
    print(f"Found {verse_count} verses")
    print(f"Found {prose_count} prose entries")
    print(f"Total items: {len(all_items)}")
    
    print(f"Writing to {output_path}...")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_items, f, ensure_ascii=False, indent=2)
    
    print("Done!")


if __name__ == '__main__':
    main()

