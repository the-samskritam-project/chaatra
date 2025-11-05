"""
Dictionary data loading functions.

Loads and transforms dictionary entries from JSON for indexing.
"""

import json
from .utils import normalize

# Import settings - handle both absolute and relative import contexts
try:
    from settings import DATA_PATH
except ImportError:
    # Fallback for when running as module
    import os
    import sys
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    from settings import DATA_PATH  # noqa: F401


def load_data(path=DATA_PATH):
    """
    Load dictionary data from JSON file and prepare for indexing.
    
    Transforms raw dictionary entries into a format suitable for embedding:
    - Normalizes headwords and meanings
    - Creates searchable text combining headword (SLP1 + Sanskrit), meaning, and examples (SLP1 + Sanskrit)
    - Preserves metadata (id, sense, partOfSpeech, examples)
    
    Args:
        path: Path to the JSON file containing dictionary entries
        
    Returns:
        List of dictionaries, each containing:
        - id: Unique identifier
        - sense: Sense number (e.g., "sense_1")
        - headword: SLP1 transliteration
        - meaning: English definition
        - partOfSpeech: Part of speech abbreviation
        - examples: List of example usages
        - text: Combined headword (SLP1 + Sanskrit) + meaning + examples (SLP1 + Sanskrit) for embedding
    """
    with open(path, "r", encoding="utf-8") as f:
        rows = json.load(f)
    
    items = []
    for r in rows:
        # Extract and normalize key fields
        head = normalize(r.get("slp1Str", ""))
        head_sanskrit = normalize(r.get("sanskritString", ""))
        meaning = normalize(r.get("meaning", ""))
        
        # Extract example texts (both SLP1 and Sanskrit)
        examples = r.get("examples", [])
        example_texts = []
        for ex in examples:
            ex_slp1 = ex.get("slp1", "").strip()
            ex_sanskrit = ex.get("sanskrit", "").strip()
            
            if ex_slp1:
                # Combine SLP1 and Sanskrit if both exist
                if ex_sanskrit:
                    example_texts.append(f"{ex_slp1} — {ex_sanskrit}")
                else:
                    example_texts.append(ex_slp1)
        
        # Combine for semantic search: headword (SLP1 + Sanskrit), meaning, and examples
        text_parts = []
        
        # Add headword with Sanskrit if available
        if head_sanskrit:
            text_parts.append(f"{head} — {head_sanskrit} — {meaning}")
        else:
            text_parts.append(f"{head} — {meaning}")
        
        # Add examples
        if example_texts:
            text_parts.append(" | ".join(example_texts))
        
        text = normalize(" | ".join(text_parts))
        
        items.append({
            "id": r.get("id"),
            "sense": r.get("sense", ""),
            "headword": head,
            "meaning": meaning,
            "partOfSpeech": r.get("partOfSpeech", ""),
            "examples": examples,
            "text": text
        })
    
    return items

