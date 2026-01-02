"""Extract Aditya Hridaya Stotra command handler."""

import os
import sys

from processor.extract_aditya_hridaya import extract_aditya_hridaya_to_mongodb
from . import register_command


def handle(args):
    """Execute extract_aditya_hridaya_stotra command."""
    # Get JSON path (default: backend/chroma_db/valmiki_ramayan_shlokas.json)
    json_path = getattr(args, 'stotra_json_path', None)
    if not json_path:
        # Default path relative to project root
        # __file__ is corpus/commands/extract_aditya_hridaya_stotra.py, so dirname twice gets project root
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        json_path = os.path.join(project_root, 'backend', 'chroma_db', 'valmiki_ramayan_shlokas.json')
    
    if not os.path.exists(json_path):
        print(f"Error: JSON file not found: {json_path}")
        sys.exit(1)
    
    # Get MongoDB URI
    mongodb_uri = args.mongodb_uri or os.getenv('MONGODB_URI')
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)
    
    # Get database name (defaults to aditya_hridaya_stotra)
    database_name = args.database or 'aditya_hridaya_stotra'
    
    extract_aditya_hridaya_to_mongodb(
        json_path=json_path,
        mongodb_uri=mongodb_uri,
        database_name=database_name
    )


register_command('extract_aditya_hridaya_stotra', handle)

