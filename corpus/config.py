"""
Corpus configuration module.

Provides corpus configuration data and helper functions.
"""

# Corpus configuration: maps corpus names to verse patterns
CORPUS_CONFIG = {
    'hitopadesa': {
        'verse_pattern': r'//\s*Hit_(\d+\.\d+)\s*//',
        'xml_file': 'hitopadesa.xml'
    },
    'pancatantra': {
        'verse_pattern': r'\|\|Panc_(\d+\.\d+)\|\|',
        'xml_file': 'pancatantra.xml'
    },
    'bhagavad_gita': {
        'verse_pattern': r'\|\|BhG_(\d+\.\d+)\|\|',
        'xml_file': 'bhagavad_gita_sankara_bhashya.xml'
    },
    'subhashita': {
        'verse_pattern': 'xml_id:MSS_(\d+)',
        'xml_file': 'subhashita.xml'
    }
}


def get_corpus_config(corpus_name: str):
    """
    Get configuration for a corpus.
    
    Args:
        corpus_name: Name of the corpus
        
    Returns:
        Dictionary with verse_pattern and xml_file
        
    Raises:
        ValueError: If corpus name is not recognized
    """
    corpus_name_lower = corpus_name.lower()
    if corpus_name_lower not in CORPUS_CONFIG:
        available = ', '.join(CORPUS_CONFIG.keys())
        raise ValueError(
            f"Unknown corpus: {corpus_name}. Available: {available}"
        )
    return CORPUS_CONFIG[corpus_name_lower]

