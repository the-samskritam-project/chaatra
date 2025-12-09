#!/usr/bin/env python3
"""
IAST (International Alphabet of Sanskrit Transliteration) to Devanagari transliterator.

This module provides functions to transliterate Sanskrit text from IAST format
to Devanagari script.
"""

import re
from typing import Optional

try:
    # Preferred: use indic-transliteration for accurate conjuncts/half-consonants
    from indic_transliteration.sanscript import (
        DEVANAGARI,
        IAST,
        transliterate,
    )
except ImportError:
    transliterate = None
    DEVANAGARI = None
    IAST = None

DEV_VOWEL_SIGNS = {
    'अ': '',
    'आ': 'ा',
    'इ': 'ि',
    'ई': 'ी',
    'उ': 'ु',
    'ऊ': 'ू',
    'ऋ': 'ृ',
    'ॠ': 'ॄ',
    'ऌ': 'ॢ',
    'ॡ': 'ॣ',
    'ए': 'े',
    'ऐ': 'ै',
    'ओ': 'ो',
    'औ': 'ौ',
}


def _join_consonant_vowel(text: str) -> str:
    """Join consonant + halant + independent vowel into consonant + vowel sign."""
    def repl(match):
        cons_halant = match.group(1)  # e.g., म्
        vowel = match.group(2)        # e.g., अ
        cons = cons_halant[:-1]       # drop halant
        sign = DEV_VOWEL_SIGNS.get(vowel, '')
        return cons + sign

    return re.sub(r'([क-ह]्)([अआइईउऊऋॠऌॡएऐओऔ])', repl, text)


# IAST to Devanagari mapping
IAST_VOWELS = {
    'a': 'अ', 'ā': 'आ', 'i': 'इ', 'ī': 'ई',
    'u': 'उ', 'ū': 'ऊ', 'ṛ': 'ऋ', 'ṝ': 'ॠ',
    'ḷ': 'ऌ', 'ḹ': 'ॡ', 'e': 'ए', 'ai': 'ऐ',
    'o': 'ओ', 'au': 'औ'
}

IAST_VOWEL_SIGNS = {
    'आ': 'ा', 'इ': 'ि', 'ई': 'ी', 'उ': 'ु', 'ऊ': 'ू',
    'ऋ': 'ृ', 'ॠ': 'ॄ', 'ऌ': 'ॢ', 'ॡ': 'ॣ',
    'ए': 'े', 'ऐ': 'ै', 'ओ': 'ो', 'औ': 'ौ'
}

IAST_CONSONANTS = {
    'k': 'क', 'kh': 'ख', 'g': 'ग', 'gh': 'घ', 'ṅ': 'ङ',
    'c': 'च', 'ch': 'छ', 'j': 'ज', 'jh': 'झ', 'ñ': 'ञ',
    'ṭ': 'ट', 'ṭh': 'ठ', 'ḍ': 'ड', 'ḍh': 'ढ', 'ṇ': 'ण',
    't': 'त', 'th': 'थ', 'd': 'द', 'dh': 'ध', 'n': 'न',
    'p': 'प', 'ph': 'फ', 'b': 'ब', 'bh': 'भ', 'm': 'म',
    'y': 'य', 'r': 'र', 'l': 'ल', 'v': 'व',
    'ś': 'श', 'ṣ': 'ष', 's': 'स', 'h': 'ह'
}

VIRAMA = '्'
ANUSVARA = 'ं'
VISARGA = 'ः'


def iast_to_devanagari(text: str) -> str:
    """
    Transliterate IAST text to Devanagari.
    
    This function converts Sanskrit text from IAST (International Alphabet of
    Sanskrit Transliteration) format to Devanagari script. It handles:
    - Vowels (short and long, including diphthongs)
    - Consonants (including aspirated consonants)
    - Consonant clusters (with virama)
    - Diacritics (anusvara, visarga)
    - Avagraha (apostrophe)
    
    Args:
        text: IAST transliterated Sanskrit text
        
    Returns:
        Devanagari text
        
    Examples:
        >>> iast_to_devanagari("siddhiḥ")
        'सिद्धिः'
        >>> iast_to_devanagari("hitopadeśa")
        'हितोपदेश'
    """
    if not text:
        return ''

    # Normalize intra-word hyphens that should not break conjuncts (e.g., yan-mūrdhni)
    # Remove hyphens when they occur between letters.
    text = re.sub(r'(?<=\w)-(?!\s)(?=\w)', '', text)

    # Normalize split sandhi like "satām astu" -> "satāmastu" (join nasal+vowel across space)
    text = re.sub(r'(?<=[mṃṁṅñṇ])\\s+(?=[aāiīuūṛṝḷḹeoAEO])', '', text, flags=re.IGNORECASE)

    # Prefer library transliteration for correctness (handles conjuncts/virama)
    if transliterate and IAST and DEVANAGARI:
        output = transliterate(text, IAST, DEVANAGARI)
        # Join any virama-ending across spaces: "् " -> "्"
        output = re.sub(r'्\s+', '्', output)
        # Join consonant-halant + independent vowel into consonant + vowel sign
        output = _join_consonant_vowel(output)
        return output

    # Legacy fallback: existing in-repo transliteration
    # Check if already in Devanagari
    devanagari_pattern = re.compile(r'^[\u0900-\u097F\s|]+$')
    if devanagari_pattern.match(text):
        return text
    
    result = []
    i = 0
    text_len = len(text)
    
    def peek_ahead(offset: int) -> Optional[str]:
        """Peek ahead at character at offset, return None if out of bounds."""
        if i + offset < text_len:
            return text[i + offset]
        return None
    
    while i < text_len:
        char = text[i]
        
        # Handle whitespace and punctuation
        if char in ' \n\t|':
            result.append(char)
            i += 1
            continue
        
        # Handle avagraha (apostrophe)
        if char == "'":
            result.append('ऽ')
            i += 1
            continue
        
        # Handle anusvara (ṃ)
        if char == 'ṃ':
            result.append(ANUSVARA)
            i += 1
            continue
        
        # Handle visarga (ḥ)
        if char == 'ḥ':
            result.append(VISARGA)
            i += 1
            continue
        
        # Try to match longer sequences first (diphthongs and aspirated consonants)
        matched = False
        
        # Check for diphthongs (ai, au) - these are vowels
        if i + 1 < text_len:
            two_char = text[i:i+2]
            if two_char == 'ai':
                result.append(IAST_VOWELS['ai'])
                i += 2
                matched = True
            elif two_char == 'au':
                result.append(IAST_VOWELS['au'])
                i += 2
                matched = True
        
        if matched:
            continue
        
        # Check for two-character consonants (aspirated: kh, gh, ch, jh, th, dh, ph, bh, ṭh, ḍh)
        if i + 1 < text_len:
            two_char = text[i:i+2]
            if two_char in IAST_CONSONANTS:
                consonant = IAST_CONSONANTS[two_char]
                # Look ahead for vowel or consonant
                next_char = peek_ahead(2)
                if next_char and next_char in IAST_VOWELS:
                    # Consonant followed by vowel
                    vowel = IAST_VOWELS[next_char]
                    result.append(consonant)
                    if vowel != 'अ':
                        result.append(IAST_VOWEL_SIGNS[vowel])
                    i += 3
                    matched = True
                elif next_char and next_char in IAST_CONSONANTS:
                    # Consonant cluster - add virama
                    result.append(consonant)
                    result.append(VIRAMA)
                    i += 2
                    matched = True
                elif next_char in ['ṃ', 'ḥ']:
                    # Consonant followed by anusvara/visarga
                    result.append(consonant)
                    i += 2
                    matched = True
                else:
                    # End of word - add virama
                    result.append(consonant)
                    result.append(VIRAMA)
                    i += 2
                    matched = True
        
        if matched:
            continue
        
        # Try single character vowels
        if char in IAST_VOWELS:
            result.append(IAST_VOWELS[char])
            i += 1
            continue
        
        # Try single character consonants
        if char in IAST_CONSONANTS:
            consonant = IAST_CONSONANTS[char]
            next_char = peek_ahead(1)
            if next_char and next_char in IAST_VOWELS:
                # Consonant followed by vowel
                vowel = IAST_VOWELS[next_char]
                result.append(consonant)
                if vowel != 'अ':
                    result.append(IAST_VOWEL_SIGNS[vowel])
                i += 2
            elif next_char and next_char in IAST_CONSONANTS:
                # Consonant cluster - add virama
                result.append(consonant)
                result.append(VIRAMA)
                i += 1
            elif next_char in ['ṃ', 'ḥ']:
                # Consonant followed by anusvara/visarga
                result.append(consonant)
                i += 2
            else:
                # End of word or space - add virama
                result.append(consonant)
                if not next_char or next_char in ' \n\t|':
                    result.append(VIRAMA)
                i += 1
            continue
        
        # If no match, keep the character as is
        result.append(char)
        i += 1
    
    return ''.join(result)

