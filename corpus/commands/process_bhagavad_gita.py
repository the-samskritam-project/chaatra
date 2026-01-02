"""Process Bhagavad Gita command handler."""

import os
import sys

from processor.process_bhagavad_gita import process_bhagavad_gita_verses
from . import register_command


def handle(corpus_name: str, args):
    """Execute process_bhagavad_gita command."""
    corpus_name_lower = corpus_name.lower()
    if corpus_name_lower != 'bhagavad_gita':
        print("Error: process_bhagavad_gita command only works with bhagavad_gita corpus")
        sys.exit(1)
    
    # Get API base URL from arg or environment variable, default to localhost
    api_base_url = args.api_url or os.getenv('API_BASE_URL') or 'http://localhost:8081'
    
    # Get chapter range
    start_chapter = getattr(args, 'process_start_chapter', None)
    end_chapter = getattr(args, 'process_end_chapter', None)
    
    # Get delay (default 0.5 seconds)
    delay = getattr(args, 'process_delay', 0.5)
    
    process_bhagavad_gita_verses(
        api_base_url=api_base_url,
        start_chapter=start_chapter,
        end_chapter=end_chapter,
        delay=delay
    )


register_command('process_bhagavad_gita', handle)

