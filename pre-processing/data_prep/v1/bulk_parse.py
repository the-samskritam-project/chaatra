#!/usr/bin/env python3
"""
Bulk parser: read a dictionary file line-by-line where each line contains an <H1> entry,
and aggregate all meanings across entries into a single JSON array output.
"""

import os
import sys
import json
import xml.etree.ElementTree as ET
import urllib.request
import urllib.parse
import urllib.error

from dictionary_parser import (
    parse_dictionary_entry_from_element,
    entry_to_json,
)


def transliterate_slp1(slp1: str) -> str:
    """
    Transliterate SLP1 string to Devanagari Sanskrit using the local API.
    
    Args:
        slp1: SLP1 transliteration string
        
    Returns:
        Devanagari Sanskrit string, or empty string on error
    """
    if not slp1 or not slp1.strip():
        return ""
    
    try:
        url = f"http://localhost:8081/transliterate?slp1={urllib.parse.quote(slp1)}"
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get("devanagari", "")
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, KeyError, TimeoutError):
        # Silently return empty string on any error
        return ""


def process_dictionary_lines(input_path: str, output_path: str) -> None:
    all_meanings = []

    with open(input_path, 'r', encoding='utf-8') as f:
        for _, line in enumerate(f, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            if '<H1' not in stripped:
                # Skip non-entry lines
                continue
            try:
                element = ET.fromstring(stripped)
            except ET.ParseError:
                # Some lines may have leading/trailing text; try to extract the <H1> ... </H1>
                try:
                    start = stripped.find('<H1')
                    end = stripped.rfind('</H1>')
                    if start != -1 and end != -1:
                        fragment = stripped[start:end+5]
                        element = ET.fromstring(fragment)
                    else:
                        continue
                except ET.ParseError:
                    continue

            entry = parse_dictionary_entry_from_element(element)
            if not entry:
                continue
            json_entries = entry_to_json(entry)
            
            # Transliterate words and examples
            for json_entry in json_entries:
                # Transliterate the word (slp1Str)
                slp1_str = json_entry.get("slp1Str", "")
                if slp1_str:
                    json_entry["sanskritString"] = transliterate_slp1(slp1_str)
                
                # Transliterate examples
                examples = json_entry.get("examples", [])
                for example in examples:
                    slp1_example = example.get("slp1", "")
                    if slp1_example:
                        example["sanskrit"] = transliterate_slp1(slp1_example)
            
            all_meanings.extend(json_entries)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as out:
        json.dump(all_meanings, out, ensure_ascii=False, indent=2)


def main():
    # Defaults
    default_input = os.path.join('data', 'input', 'dictionary.xml')
    default_output = os.path.join('data', 'output', 'parsed_dictionary.json')

    if len(sys.argv) > 1:
        input_path = sys.argv[1]
    else:
        input_path = default_input

    if len(sys.argv) > 2:
        output_path = sys.argv[2]
    else:
        output_path = default_output

    process_dictionary_lines(input_path, output_path)
    print(f"Wrote combined meanings JSON: {output_path}")


if __name__ == '__main__':
    main()


