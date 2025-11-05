"""
Utility functions for text processing.

Shared utilities used by core modules.
"""

import re


def normalize(s: str) -> str:
    """
    Normalize text by trimming whitespace and collapsing multiple spaces.
    
    Args:
        s: Input string to normalize
        
    Returns:
        Normalized string with single spaces and trimmed edges
    """
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    return s

