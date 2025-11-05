"""
Output formatting functions for search results.

Converts search results into human-readable formatted strings.
"""

from settings import USE_CHROMA

if USE_CHROMA:
    from core.search_chroma import find_other_meanings_chroma as find_other_meanings
else:
    from core.search import find_other_meanings


def format_result(r, idx):
    """
    Format a single search result with full details.
    
    Includes:
    - Score and metadata
    - Full meaning
    - All examples with sources
    - Other meanings of the same headword
    
    Args:
        r: Result dictionary from search()
        idx: Result number (1-indexed)
        
    Returns:
        Formatted string for this result
    """
    lines = []
    
    # Header with score
    lines.append(f"\n{'─' * 80}")
    lines.append(f"Result #{idx} (Score: {r['score']:.3f})")
    lines.append(f"{'─' * 80}")
    
    # SLP1 Headword
    lines.append(f"  SLP1: {r['headword']}")
    
    # Metadata (sense and part of speech)
    metadata_parts = []
    if r.get('sense'):
        metadata_parts.append(f"Sense: {r['sense']}")
    if r.get('partOfSpeech'):
        metadata_parts.append(f"POS: {r['partOfSpeech']}")
    if metadata_parts:
        lines.append(f"  {' | '.join(metadata_parts)}")
    lines.append("")
    
    # Full meaning text
    meaning = r['meaning'].strip()
    if meaning:
        lines.append("  Meaning:")
        lines.append(f"    {meaning}")
        lines.append("")
    
    # Examples with sources and Sanskrit
    examples = r.get('examples', [])
    if examples:
        lines.append(f"  Examples ({len(examples)}):")
        for ex in examples:
            ex_line = f"    • {ex.get('slp1', '')}"
            if ex.get('source'):
                ex_line += f"  [Source: {ex['source']}]"
            if ex.get('sanskrit'):
                ex_line += f"  (Sanskrit: {ex['sanskrit']})"
            lines.append(ex_line)
        lines.append("")
    
    # Other meanings of the same headword
    other_meanings = find_other_meanings(r['headword'], r['id'])
    if other_meanings:
        lines.append(f"  Other meanings of '{r['headword']}' ({len(other_meanings)}):")
        for om in other_meanings:
            om_line = f"    [{om['sense']}]"
            if om.get('partOfSpeech'):
                om_line += f" ({om['partOfSpeech']})"
            # Truncate long meanings
            om_line += f" {om['meaning'][:150]}"
            if len(om['meaning']) > 150:
                om_line += "..."
            lines.append(om_line)
        lines.append("")
    
    return "\n".join(lines)


def format_results(query, results):
    """
    Format all search results with header and footer.
    
    Args:
        query: Original search query
        results: List of result dictionaries from search()
        
    Returns:
        Complete formatted output string
    """
    lines = []
    
    # Header
    lines.append("=" * 80)
    lines.append(f"Query: {query}")
    lines.append("=" * 80)
    lines.append("")
    
    # Format each result
    for idx, r in enumerate(results, 1):
        lines.append(format_result(r, idx))
    
    # Footer
    lines.append(f"\n{'=' * 80}")
    lines.append(f"Found {len(results)} results")
    lines.append("=" * 80)
    
    return "\n".join(lines)

