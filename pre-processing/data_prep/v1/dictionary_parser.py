"""
Parser for Sanskrit dictionary XML entries.
Extracts word and meanings from dictionary XML structure.
"""

import json
import uuid
import xml.etree.ElementTree as ET
import re
from typing import List, Optional, Dict, Any

from text_utils import extract_text, clean_whitespace, strip_xml_tags


class ExampleData:
    """Represents an example with SLP1, optional Sanskrit, and optional source."""
    
    def __init__(self, slp1: str, sanskrit: str = "", source: str = ""):
        self.slp1 = slp1
        self.sanskrit = sanskrit
        self.source = source
    
    def to_dict(self) -> Dict[str, str]:
        """Convert to dictionary for JSON serialization."""
        return {
            "slp1": self.slp1,
            "sanskrit": self.sanskrit,
            "source": self.source,
        }


class MeaningData:
    """Represents a meaning with its id, sense, text, examples, and part of speech."""
    
    def __init__(self, text: str, examples: List[ExampleData], part_of_speech: str = "", sense: str = "", meaning_id: str = ""):
        self.id = meaning_id or str(uuid.uuid4())
        self.sense = sense
        self.text = text
        self.examples = examples
        self.part_of_speech = part_of_speech


class DictionaryEntry:
    """Represents a dictionary entry with word and meanings."""
    
    def __init__(self, word: str, meanings: List[MeaningData]):
        self.word = word
        self.meanings = meanings
    
    def __repr__(self) -> str:
        return f"DictionaryEntry(word='{self.word}', meanings_count={len(self.meanings)})"


def extract_part_of_speech(content: str) -> str:
    """
    Extract part of speech from <ab> tags at the beginning of the meaning.
    Common abbreviations: N. (Noun), m. (masculine), f. (feminine), a. (adjective),
    ind. (indeclinable), n. (neuter), pl. (plural), du. (dual).
    
    Args:
        content: XML content string from a meaning section
        
    Returns:
        Part of speech abbreviation or empty string if not found
    """
    # Look for <ab> tags near the start of the content (after possible whitespace)
    # Pattern to match <ab>...</ab> at the beginning, possibly after whitespace
    pattern = r'^\s*<ab\s*(?:n="[^"]*")?\s*>(.*?)</ab>'
    match = re.search(pattern, content, re.DOTALL)
    
    if match:
        ab_text = match.group(1).strip()
        # Remove trailing period if present (e.g., "N." -> "N")
        ab_text = ab_text.rstrip('.')
        
        # Common part of speech abbreviations to extract
        pos_abbrevs = ['N', 'm', 'f', 'a', 'ind', 'n', 'pl', 'du', 'U']
        
        # Check if the abbreviation is a known part of speech
        if ab_text in pos_abbrevs:
            return ab_text + '.' if not ab_text.endswith('.') else ab_text
        
        # Also check for full forms or other variations
        ab_lower = ab_text.lower()
        if ab_lower in ['n.', 'n', 'noun']:
            return 'N.'
        elif ab_lower in ['m.', 'm', 'masculine']:
            return 'm.'
        elif ab_lower in ['f.', 'f', 'feminine']:
            return 'f.'
        elif ab_lower in ['a.', 'a', 'adjective', 'adj']:
            return 'a.'
        elif ab_lower in ['ind.', 'ind', 'indeclinable']:
            return 'ind.'
        elif ab_lower in ['n.', 'neuter']:
            return 'n.'
        elif ab_lower in ['pl.', 'pl', 'plural']:
            return 'pl.'
        elif ab_lower in ['du.', 'du', 'dual']:
            return 'du.'
    
    return ""


def extract_examples(content: str) -> List[ExampleData]:
    """
    Extract all text from <s> tags in the content.
    Each example will have slp1 (from the tag) and sanskrit (empty for now).
    
    Args:
        content: XML content string
        
    Returns:
        List of ExampleData objects from <s> tags
    """
    examples = []
    # Find all <s>...</s> with their positions to look ahead for immediate <ls>...</ls>
    s_pattern = re.compile(r'<s>(.*?)</s>', re.DOTALL)
    ls_follow_pattern = re.compile(r'^\s*[;,:-]?\s*<ls(?:\s+[^>]*)?>(.*?)</ls>', re.DOTALL)

    for s_match in s_pattern.finditer(content):
        s_text = s_match.group(1).strip()
        if not s_text:
            continue
        slp1_text = clean_whitespace(s_text)
        source_text = ""

        # Look immediately after </s> for an <ls>...</ls>, ignoring whitespace and punctuation
        tail = content[s_match.end():]
        ls_match = ls_follow_pattern.match(tail)
        if ls_match:
            source_text = clean_whitespace(ls_match.group(1))

        examples.append(ExampleData(slp1=slp1_text, sanskrit="", source=source_text))

    return examples


def extract_meanings(body_element: ET.Element) -> List[MeaningData]:
    """
    Extract meanings from body element following pattern <b>N</b>{meaning}<div n="1"/>.
    
    Args:
        body_element: XML body element containing dictionary definitions
        
    Returns:
        List of MeaningData objects
    """
    meanings = []
    
    # Convert body element to string to work with text pattern
    body_str = ET.tostring(body_element, encoding='unicode', method='xml')
    
    # Pattern to match <b>number</b> followed by content until <div n="1"/> or next <b>
    # This regex finds <b>N</b> and captures everything until <div n="1"/> or <b>
    pattern = r'<b>(\d+)</b>(.*?)(?=<div\s+n=["\']?1["\']?\s*/>|<b>|$)'
    
    matches = re.finditer(pattern, body_str, re.DOTALL)
    
    for match in matches:
        number_str = match.group(1)
        content = match.group(2)
        
        # Extract part of speech from <ab> tags
        part_of_speech = extract_part_of_speech(content)
        
        # Extract examples from <s> tags
        examples = extract_examples(content)
        
        # Parse the content XML to extract meaning text
        try:
            # Wrap in a temporary element to parse
            temp_xml = f'<temp>{content}</temp>'
            ET.fromstring(temp_xml)  # validate fragment parses
            
            # Extract text without <s> tags for the meaning
            # First, let's try removing <s> tags from the string
            content_without_s = re.sub(r'<s>.*?</s>', '', content, flags=re.DOTALL)
            temp_xml_no_s = f'<temp>{content_without_s}</temp>'
            temp_elem_no_s = ET.fromstring(temp_xml_no_s)
            meaning_text = extract_text(temp_elem_no_s).strip()
            
            if meaning_text:
                meanings.append(MeaningData(
                    text=meaning_text,
                    examples=examples,
                    part_of_speech=part_of_speech,
                    sense=f"sense_{number_str}",
                    meaning_id=str(uuid.uuid4()),
                ))
        except ET.ParseError:
            # If XML parsing fails, just strip tags and use raw text
            content_without_s = re.sub(r'<s>.*?</s>', '', content, flags=re.DOTALL)
            meaning_text = strip_xml_tags(content_without_s)
            meaning_text = clean_whitespace(meaning_text)
            if meaning_text or examples:
                meanings.append(MeaningData(
                    text=meaning_text,
                    examples=examples,
                    part_of_speech=part_of_speech,
                    sense=f"sense_{number_str}",
                    meaning_id=str(uuid.uuid4()),
                ))
    
    return meanings


def extract_word(root: ET.Element) -> Optional[str]:
    """
    Extract word from <h><key1> element.
    
    Args:
        root: Root XML element
        
    Returns:
        Word string or None if not found
    """
    key1_elem = root.find('.//key1')
    if key1_elem is None:
        return None
    
    return key1_elem.text.strip() if key1_elem.text else ""


def parse_dictionary_entry_from_element(root: ET.Element) -> Optional[DictionaryEntry]:
    """
    Parse an already-parsed XML element <H1> and extract word and meanings.
    """
    # Extract word
    word = extract_word(root)
    if word is None:
        return None
    # Extract body
    body_elem = root.find('.//body')
    if body_elem is None:
        return None
    meanings = extract_meanings(body_elem)
    return DictionaryEntry(word=word, meanings=meanings)

def parse_dictionary_entry(file_path: str) -> Optional[DictionaryEntry]:
    """
    Parse XML file and extract word and meanings.
    
    Args:
        file_path: Path to XML file
        
    Returns:
        DictionaryEntry object or None if parsing fails
    """
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
    except (ET.ParseError, FileNotFoundError) as e:
        print(f"Error parsing XML file: {e}")
        return None
    
    # Extract word from <h><key1>
    word = extract_word(root)
    if word is None:
        print("Error: Could not find <key1> element")
        return None
    
    # Extract body
    body_elem = root.find('.//body')
    if body_elem is None:
        print("Error: Could not find <body> element")
        return None
    
    # Extract meanings
    meanings = extract_meanings(body_elem)
    
    return DictionaryEntry(word=word, meanings=meanings)


def format_entry_output(entry: DictionaryEntry) -> str:
    """
    Format dictionary entry for output with numbered meanings and line breaks.
    
    Args:
        entry: DictionaryEntry to format
        
    Returns:
        Formatted string with word and numbered meanings
    """
    lines = [entry.word, ""]
    
    for idx, meaning_data in enumerate(entry.meanings, start=1):
        lines.append(f"{idx}. {meaning_data.text}")
        if meaning_data.examples:
            example_texts = [ex.slp1 for ex in meaning_data.examples]
            lines.append(f"   Examples: {', '.join(example_texts)}")
        lines.append("")  # Add blank line between meanings for clarity
    
    return "\n".join(lines)


def entry_to_json(entry: DictionaryEntry) -> List[Dict[str, Any]]:
    """
    Convert dictionary entry to JSON format.
    Each meaning becomes its own JSON object.
    
    Args:
        entry: DictionaryEntry to convert
        
    Returns:
        List of JSON objects, one per meaning
    """
    json_entries = []
    
    for meaning_data in entry.meanings:
        # Convert examples to list of dicts
        examples_list = [example.to_dict() for example in meaning_data.examples]
        
        json_entry = {
            "slp1Str": entry.word,
            "sanskritString": "",
            "meaning": meaning_data.text,
            "id": meaning_data.id,
            "sense": meaning_data.sense,
            "partOfSpeech": meaning_data.part_of_speech,
            "examples": examples_list
        }
        json_entries.append(json_entry)
    
    return json_entries


def save_entry_to_json(entry: DictionaryEntry, output_file: str) -> None:
    """
    Save dictionary entry to JSON file.
    Each meaning is saved as a separate JSON object in an array.
    
    Args:
        entry: DictionaryEntry to save
        output_file: Path to output JSON file
    """
    json_entries = entry_to_json(entry)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(json_entries, f, ensure_ascii=False, indent=2)

