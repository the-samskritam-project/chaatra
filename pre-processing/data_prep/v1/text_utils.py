"""
Text extraction and cleaning utilities for dictionary entries.
"""

import xml.etree.ElementTree as ET
import re


def extract_text(element: ET.Element) -> str:
    """
    Extract all text content from an element and its children recursively.
    
    Args:
        element: XML element to extract text from
        
    Returns:
        Clean text with normalized whitespace
    """
    text_parts = []
    
    if element.text:
        text_parts.append(element.text.strip())
    
    for child in element:
        text_parts.append(extract_text(child))
        if child.tail:
            text_parts.append(child.tail.strip())
    
    # Join and clean up spacing
    result = ' '.join(text_parts)
    # Normalize whitespace: collapse multiple spaces/tabs/newlines to single space
    result = ' '.join(result.split())
    return result


def clean_whitespace(text: str) -> str:
    """
    Normalize whitespace in text by collapsing multiple spaces/tabs/newlines.
    
    Args:
        text: Text to clean
        
    Returns:
        Text with normalized whitespace
    """
    return ' '.join(text.split())


def strip_xml_tags(content: str) -> str:
    """
    Strip XML tags from content string.
    
    Args:
        content: String containing XML tags
        
    Returns:
        Text with tags removed
    """
    return re.sub(r'<[^>]+>', '', content).strip()

