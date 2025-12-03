#!/usr/bin/env python3
"""
Transliterate Hitopadesa XML from IAST to Devanagari.

Extracts verses from the XML file and outputs JSON with verse numbers,
original IAST text, and Devanagari transliteration.
"""

import xml.etree.ElementTree as ET
import json
import re
from typing import List, Dict, Optional

from iast_transliterator import iast_to_devanagari


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


def parse_hitopadesa_xml(xml_path: str) -> List[Dict[str, str]]:
    """
    Parse Hitopadesa XML and extract verses.
    
    Args:
        xml_path: Path to the XML file
        
    Returns:
        List of verse dictionaries with verse_number, original_iast, and transliterated_devanagari
    """
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    # Define namespace
    ns = {'tei': 'http://www.tei-c.org/ns/1.0'}
    
    # Find the body element (starting from line 312 area)
    body = root.find('.//tei:body', ns)
    if body is None:
        # Try without namespace
        body = root.find('.//body')
    
    if body is None:
        raise ValueError("Could not find body element in XML")
    
    verses = []
    
    # Find all line groups (lg elements)
    lg_elements = body.findall('.//tei:lg', ns) if body.findall('.//tei:lg', ns) else body.findall('.//lg')
    
    for lg in lg_elements:
        # Get all line elements (l)
        l_elements = lg.findall('.//tei:l', ns) if lg.findall('.//tei:l', ns) else lg.findall('.//l')
        
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
            # Transliterate to Devanagari
            devanagari = iast_to_devanagari(clean_verse)
            
            verses.append({
                'verse_number': verse_number,
                'original_iast': clean_verse,
                'transliterated_devanagari': devanagari
            })
    
    return verses


def main():
    """Main function to process XML and generate JSON output."""
    xml_path = 'hitopadesa.xml'
    output_path = 'hitopadesa_verses.json'
    
    print(f"Parsing {xml_path}...")
    verses = parse_hitopadesa_xml(xml_path)
    
    print(f"Found {len(verses)} verses")
    print(f"Writing to {output_path}...")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(verses, f, ensure_ascii=False, indent=2)
    
    print("Done!")


if __name__ == '__main__':
    main()

