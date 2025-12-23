"""
Bhagavad Gita XML parser.

Functions for parsing Bhagavad Gita XML files and extracting chapters, verses, and commentary.
"""

import xml.etree.ElementTree as ET
import re
from typing import Dict, List, Optional
from collections import defaultdict

from processor.transliterators.iast import iast_to_devanagari


def extract_element_text(elem: ET.Element) -> str:
    """
    Extract all text content from an XML element including nested elements.
    
    Args:
        elem: XML element to extract text from
        
    Returns:
        Complete text content with normalized whitespace
    """
    text_parts = []
    
    if elem.text:
        text_parts.append(elem.text)
    
    for child in elem:
        text_parts.append(extract_element_text(child))
        if child.tail:
            text_parts.append(child.tail)
    
    # Join and normalize whitespace
    result = ''.join(text_parts)
    # Normalize whitespace: collapse multiple spaces/tabs/newlines to single space
    result = ' '.join(result.split())
    return result


def extract_verse_number(text: str) -> Optional[str]:
    """
    Extract verse number from text in format ||BhG_X.Y||
    
    Args:
        text: Text containing verse number marker
        
    Returns:
        Verse number string (e.g., "1.1", "16.1") or None
    """
    match = re.search(r'\|\|BhG_(\d+\.\d+)\|\|', text)
    if match:
        return match.group(1)
    return None


def is_chapter_marker(text: str) -> bool:
    """
    Check if text is a chapter marker like "BhG 1" or "BhG 16"
    
    Args:
        text: Text to check
        
    Returns:
        True if it's a chapter marker
    """
    return bool(re.match(r'^BhG\s+\d+$', text.strip()))


def get_chapter_number(text: str) -> Optional[int]:
    """
    Extract chapter number from chapter marker text.
    
    Args:
        text: Chapter marker text (e.g., "BhG 1", "BhG 16")
        
    Returns:
        Chapter number as integer or None
    """
    match = re.search(r'BhG\s+(\d+)', text)
    if match:
        return int(match.group(1))
    return None


def clean_text(text: str) -> str:
    """
    Clean text by removing extra whitespace.
    
    Args:
        text: Text to clean
        
    Returns:
        Cleaned text
    """
    if not text:
        return ''
    # Remove leading/trailing whitespace and normalize internal whitespace
    text = ' '.join(text.split())
    return text.strip()


def parse_bhagavad_gita_xml(xml_path: str) -> Dict[int, List[Dict]]:
    """
    Parse Bhagavad Gita XML file and extract chapters, verses, and commentary.
    
    Args:
        xml_path: Path to the XML file
        
    Returns:
        Dictionary mapping chapter numbers to lists of items (verses and commentary)
    """
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    # Define namespace
    ns = {'tei': 'http://www.tei-c.org/ns/1.0'}
    
    # Find the body element
    body = root.find('.//tei:body', ns)
    if body is None:
        body = root.find('.//body')
    
    if body is None:
        raise ValueError("Could not find body element in XML")
    
    # Dictionary to store items by chapter
    chapters = defaultdict(list)
    
    # Track current chapter and global sequence
    current_chapter = None
    global_sequence = 0
    
    # Get all lg and p elements in document order
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
        
        # Process paragraph elements
        if tag == 'p':
            text = extract_element_text(elem).strip()
            if not text:
                continue
            
            # Check if it's a chapter marker
            if is_chapter_marker(text):
                chapter_num = get_chapter_number(text)
                if chapter_num is not None:
                    current_chapter = chapter_num
                    print(f"Found chapter {current_chapter}")
                continue
            
            # Skip separator lines
            if text.startswith('===') or text == '==============================':
                continue
            
            # Skip empty or very short paragraphs
            if len(text) < 3:
                continue
            
            # This is commentary - add it to current chapter
            # If no chapter yet, assign to chapter 0 (intro material)
            chapter_for_commentary = current_chapter if current_chapter is not None else 0
            if chapter_for_commentary == 0:
                # For intro material, we'll still process it but note it's pre-chapter
                pass
            
            global_sequence += 1
            clean_commentary = clean_text(text)
            devanagari = iast_to_devanagari(clean_commentary)
            
            chapters[chapter_for_commentary].append({
                'type': 'commentary',
                'chapter_number': chapter_for_commentary,
                'sequence_number': global_sequence,
                'original_iast': clean_commentary,
                'transliterated_devanagari': devanagari,
                'text': clean_commentary  # Keep original for reference
            })
        
        # Process verse (lg element)
        elif tag == 'lg':
            # Get all line elements (l)
            l_elements = elem.findall('.//tei:l', ns) if elem.findall('.//tei:l', ns) else elem.findall('.//l')
            
            if not l_elements:
                continue
            
            # Combine all lines to form the complete verse
            verse_lines = []
            verse_number = None
            
            # FIRST: Check xml:id attribute for verse number (used in some XML files like Ramanuja bhashya)
            xml_id = elem.get('{http://www.w3.org/XML/1998/namespace}id') or elem.get('xml:id') or elem.get('id')
            if xml_id:
                # Extract verse number from xml:id like "BhG_18.1"
                match = re.search(r'BhG_(\d+\.\d+)', xml_id)
                if match:
                    verse_number = match.group(1)
            
            # If not found in xml:id, check text content
            if verse_number is None:
                for l_elem in l_elements:
                    line_text = extract_element_text(l_elem).strip()
                    if line_text:
                        verse_lines.append(line_text)
                        # Check for verse number in this line
                        if verse_number is None:
                            verse_number = extract_verse_number(line_text)
            else:
                # Build verse_lines if we got verse_number from xml:id
                for l_elem in l_elements:
                    line_text = extract_element_text(l_elem).strip()
                    if line_text:
                        verse_lines.append(line_text)
            
            if not verse_lines:
                continue
            
            # Join lines with newline
            full_verse = '\n'.join(verse_lines)
            
            # Extract verse number if not found yet (fallback)
            if verse_number is None:
                verse_number = extract_verse_number(full_verse)
            
            # Only process if we have a verse number
            if verse_number:
                # Replace verse number marker with closing || to mark end of verse
                clean_verse = re.sub(r'\|\|BhG_\d+\.\d+\|\|', '||', full_verse).strip()
                clean_verse = clean_text(clean_verse)
                
                # Parse chapter and verse from verse number
                parts = verse_number.split('.')
                if len(parts) == 2:
                    chapter_from_verse = int(parts[0])
                    verse_index = int(parts[1])
                    
                    # Update current chapter if we found a verse
                    if current_chapter != chapter_from_verse:
                        current_chapter = chapter_from_verse
                        print(f"Found chapter {current_chapter} from verse {verse_number}")
                    
                    global_sequence += 1
                    devanagari = iast_to_devanagari(clean_verse)
                    
                    chapters[chapter_from_verse].append({
                        'type': 'original_verse',
                        'chapter_number': chapter_from_verse,
                        'verse_number': verse_number,
                        'verse_index': verse_index,
                        'sequence_number': global_sequence,
                        'original_iast': clean_verse,
                        'transliterated_devanagari': devanagari,
                        'text': clean_verse  # Keep original for reference
                    })
    
    return dict(chapters)

