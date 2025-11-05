#!/usr/bin/env python3
"""
Main entry point for extracting word and meanings from Sanskrit dictionary XML entry.
"""

import sys
import os
from dictionary_parser import parse_dictionary_entry, save_entry_to_json


def main():
    """Main function to parse and save dictionary entry as JSON."""
    # Default to data/input folder
    default_input = 'data/input/sample_2.xml'
    
    if len(sys.argv) > 1:
        xml_file = sys.argv[1]
    else:
        xml_file = default_input
    
    entry = parse_dictionary_entry(xml_file)
    if entry:
        # Generate output filename from input filename
        base_name = os.path.splitext(os.path.basename(xml_file))[0]
        output_file = os.path.join('data', 'output', f"{base_name}_meanings.json")
        
        save_entry_to_json(entry, output_file)
        print(f"Successfully extracted {len(entry.meanings)} meanings")
        print(f"JSON output saved to: {output_file}")
    else:
        sys.exit(1)


if __name__ == '__main__':
    main()

