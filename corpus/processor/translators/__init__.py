"""
Translation module for Devanagari Sanskrit text.

Provides word-by-word and full translation functionality using OpenAI API.
"""

from processor.translators.translator import (
    translate_devanagari_word_by_word,
    translate_devanagari_full,
    translate_devanagari_complete
)
from processor.translators.text_processing import split_devanagari_words

__all__ = [
    'translate_devanagari_word_by_word',
    'translate_devanagari_full',
    'translate_devanagari_complete',
    'split_devanagari_words',
]

