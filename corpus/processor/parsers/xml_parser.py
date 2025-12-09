"""
Generic XML parsing for corpus files.

Functions for parsing XML files and extracting verses and prose.
"""

import xml.etree.ElementTree as ET
import re
from typing import List, Dict, Optional

from processor.utils.text_utils import clean_verse_text, clean_prose_text, is_prose_title_or_marker
from processor.utils.item_utils import get_chapter_from_verse_number
from processor.transliterators.iast import iast_to_devanagari


def extract_verse_number(text: str, verse_pattern: str) -> Optional[str]:
    """
    Extract verse number from text using the provided pattern.
    
    Args:
        text: Text containing verse number marker
        verse_pattern: Regex pattern with one capture group for verse number
                      (e.g., r'//\s*Hit_(\d+\.\d+)\s*//' or r'\|\|Panc_(\d+\.\d+)\|\|')
        
    Returns:
        Verse number string (e.g., "0.1") or None
    """
    match = re.search(verse_pattern, text)
    if match:
        return match.group(1)
    return None


def parse_xml(xml_path: str, verse_pattern: str) -> List[Dict[str, str]]:
    """
    Parse XML and extract verses and prose in order.
    
    Args:
        xml_path: Path to the XML file
        verse_pattern: Regex pattern with one capture group for verse number
                      (e.g., r'//\s*Hit_(\d+\.\d+)\s*//' or r'\|\|Panc_(\d+\.\d+)\|\|')
        
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
    
    # Track sequential indices
    sequence_index = 0  # Global sequence counter across all items
    chapter_sequence_counters = {}  # chapter -> sequence counter (resets per chapter)
    
    # Get all lg and p elements recursively (to handle div wrappers)
    # We need to maintain document order, so we iterate through body and collect elements
    # Use a set to track which elements we've already added (to avoid duplicates)
    seen_elements = set()
    all_elements = []
    
    # Find all lg and p elements (with namespace)
    lg_elements = body.findall('.//tei:lg', ns) if body.findall('.//tei:lg', ns) else body.findall('.//lg')
    p_elements = body.findall('.//tei:p', ns) if body.findall('.//tei:p', ns) else body.findall('.//p')
    all_target_elements = lg_elements + p_elements
    
    # Iterate through body in document order and collect elements when we encounter them
    for elem in body.iter():
        if elem in all_target_elements and id(elem) not in seen_elements:
            all_elements.append(elem)
            seen_elements.add(id(elem))
    
    # Iterate through all lg and p elements in document order
    for elem in all_elements:
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
                        verse_number = extract_verse_number(line_text, verse_pattern)
            
            if not verse_lines:
                continue
            
            # Join lines with newline
            full_verse = '\n'.join(verse_lines)
            
            # Clean the verse text (remove verse number markers)
            clean_verse = clean_verse_text(full_verse, verse_pattern)
            
            # Skip if no verse number found
            if verse_number is None:
                # Try to extract from the full text
                verse_number = extract_verse_number(full_verse, verse_pattern)
                if verse_number:
                    clean_verse = clean_verse_text(full_verse, verse_pattern)
            
            if verse_number:
                # Update current chapter
                chapter = get_chapter_from_verse_number(verse_number)
                if chapter is not None:
                    current_chapter = chapter
                
                # Update sequence indices
                sequence_index += 1
                if current_chapter is not None:
                    if current_chapter not in chapter_sequence_counters:
                        chapter_sequence_counters[current_chapter] = 0
                    chapter_sequence_counters[current_chapter] += 1
                    chapter_sequence_index = chapter_sequence_counters[current_chapter]
                else:
                    chapter_sequence_index = None
                
                # Transliterate to Devanagari
                devanagari = iast_to_devanagari(clean_verse)
                
                all_items.append({
                    'type': 'verse',
                    'verse_number': verse_number,
                    'original_iast': clean_verse,
                    'transliterated_devanagari': devanagari,
                    'sequence_index': sequence_index,
                    'chapter_sequence_index': chapter_sequence_index
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
                
                # Update sequence indices
                sequence_index += 1
                if current_chapter not in chapter_sequence_counters:
                    chapter_sequence_counters[current_chapter] = 0
                chapter_sequence_counters[current_chapter] += 1
                chapter_sequence_index = chapter_sequence_counters[current_chapter]
                
                # Clean prose text
                clean_prose = clean_prose_text(prose_text)
                
                # Transliterate to Devanagari
                devanagari = iast_to_devanagari(clean_prose)
                
                all_items.append({
                    'type': 'prose',
                    'prose_number': prose_number,
                    'chapter_number': current_chapter,
                    'original_iast': clean_prose,
                    'transliterated_devanagari': devanagari,
                    'sequence_index': sequence_index,
                    'chapter_sequence_index': chapter_sequence_index
                })
    
    return all_items

