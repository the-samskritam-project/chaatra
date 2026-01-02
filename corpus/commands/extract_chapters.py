"""Extract chapters command handler."""

import os
import sys

from processor.extract_chapters import extract_chapters_to_mongodb
from . import register_command


def handle(corpus_name: str, args):
    """Execute extract_chapters command."""
    corpus_name_lower = corpus_name.lower()
    if corpus_name_lower != 'bhagavad_gita':
        print("Error: extract_chapters command only works with bhagavad_gita corpus")
        sys.exit(1)
    
    # Get XML path
    xml_path = getattr(args, 'extract_xml_path', None)
    if not xml_path:
        print("Error: --extract-xml-path is required")
        sys.exit(1)
    
    if not os.path.exists(xml_path):
        print(f"Error: XML file not found: {xml_path}")
        sys.exit(1)
    
    # Get MongoDB URI
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    # Get chapter range
    from_chapter = getattr(args, 'extract_from_chapter', None)
    to_chapter = getattr(args, 'extract_to_chapter', None)
    
    if from_chapter is None or to_chapter is None:
        print("Error: --extract-from-chapter and --extract-to-chapter are required")
        sys.exit(1)
    
    # Get database name (defaults to bhagavad_gita_shankara_bhasya)
    database_name = args.database or 'bhagavad_gita_shankara_bhasya'
    
    # Get batch size
    batch_size = getattr(args, 'extract_batch_size', 50)
    
    # Get clear existing flag
    clear_existing = getattr(args, 'extract_clear_existing', False)
    
    extract_chapters_to_mongodb(
        xml_path=xml_path,
        mongodb_uri=mongodb_uri,
        database_name=database_name,
        from_chapter=from_chapter,
        to_chapter=to_chapter,
        batch_size=batch_size,
        clear_existing=clear_existing
    )


register_command('extract_chapters', handle)

