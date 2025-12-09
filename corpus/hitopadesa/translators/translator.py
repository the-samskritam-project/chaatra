"""
Main translation functions for Devanagari Sanskrit text.

Provides word-by-word and full translation functionality using OpenAI API.
"""

from typing import List, Dict, Tuple

from translators.api_client import make_openai_request, DEFAULT_MODEL
from translators.text_processing import split_devanagari_words
from translators.response_parser import (
    parse_translation_response,
    parse_combined_translation_response
)


def translate_devanagari_word_by_word(
    text: str, 
    api_key: str,
    model: str = DEFAULT_MODEL
) -> List[Dict[str, str]]:
    """
    Translate Devanagari text word-by-word using OpenAI API.
    
    Args:
        text: Devanagari Sanskrit text
        api_key: OpenAI API key
        model: OpenAI model to use (default: gpt-4o)
        
    Returns:
        List of dictionaries with 'word' and 'translation' keys
        
    Raises:
        ValueError: If API key is missing or API call fails
        requests.RequestException: If HTTP request fails
    """
    if not text or not text.strip():
        return []
    
    # Split text into words
    words = split_devanagari_words(text)
    
    if not words:
        return []
    
    # Filter out punctuation-only items for translation
    devanagari_words = [w for w in words if w and any('\u0900' <= c <= '\u097F' for c in w)]
    
    if not devanagari_words:
        return []
    
    # Create prompt for word-by-word translation
    words_text = ' '.join(devanagari_words)
    
    system_prompt = (
        "You are a Sanskrit scholar. Provide accurate word-by-word translations "
        "of Sanskrit Devanagari text. For each word, provide a concise English translation."
    )
    
    user_prompt = (
        f"Translate the following Sanskrit text word-by-word. "
        f"For each word, provide the English translation.\n\n"
        f"Sanskrit text: {words_text}\n\n"
        f"Provide the translation in this exact format, one word per line:\n"
        f"word1 (translation1)\n"
        f"word2 (translation2)\n"
        f"word3 (translation3)\n"
        f"...\n\n"
        f"Translate all {len(devanagari_words)} words in order."
    )
    
    # Make API call
    translation_text = make_openai_request(
        api_key=api_key,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model,
        temperature=0.3,
        max_tokens=1000
    )
    
    # Parse the translation response
    translations = parse_translation_response(translation_text, devanagari_words)
    
    return translations


def translate_devanagari_full(
    text: str,
    api_key: str,
    model: str = DEFAULT_MODEL
) -> str:
    """
    Translate Devanagari text to English (full translation).
    
    Args:
        text: Devanagari Sanskrit text
        api_key: OpenAI API key
        model: OpenAI model to use (default: gpt-4o)
        
    Returns:
        Full English translation of the text
        
    Raises:
        ValueError: If API key is missing or API call fails
        requests.RequestException: If HTTP request fails
    """
    if not text or not text.strip():
        return ""
    
    system_prompt = (
        "You are a Sanskrit scholar. Provide accurate, fluent English translations "
        "of Sanskrit Devanagari text. The translation should be natural and readable "
        "while preserving the meaning and context of the original Sanskrit."
    )
    
    user_prompt = (
        f"Translate the following Sanskrit text to English. "
        f"Provide a complete, fluent translation that captures the meaning and context.\n\n"
        f"Sanskrit text: {text}\n\n"
        f"English translation:"
    )
    
    # Make API call
    translation = make_openai_request(
        api_key=api_key,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model,
        temperature=0.3,
        max_tokens=500
    )
    
    return translation


def translate_devanagari_complete(
    text: str,
    api_key: str,
    model: str = DEFAULT_MODEL
) -> Tuple[List[Dict[str, str]], str]:
    """
    Translate Devanagari text with both word-by-word and full translation in one API call.
    
    Args:
        text: Devanagari Sanskrit text
        api_key: OpenAI API key
        model: OpenAI model to use (default: gpt-4o)
        
    Returns:
        Tuple of (word_by_word_translations, full_translation)
        - word_by_word_translations: List of dicts with 'word' and 'translation' keys
        - full_translation: Complete English translation string
        
    Raises:
        ValueError: If API key is missing or API call fails
        requests.RequestException: If HTTP request fails
    """
    if not text or not text.strip():
        return [], ""
    
    # Split text into words
    words = split_devanagari_words(text)
    devanagari_words = [w for w in words if w and any('\u0900' <= c <= '\u097F' for c in w)]
    
    if not devanagari_words:
        return [], ""
    
    words_text = ' '.join(devanagari_words)
    
    system_prompt = (
        "You are a Sanskrit scholar. Provide accurate translations of Sanskrit Devanagari text. "
        "You must provide both word-by-word translations and a complete fluent translation."
    )
    
    user_prompt = (
        f"Translate the following Sanskrit text. Provide TWO things:\n\n"
        f"1. Word-by-word translation: For each word, provide the English translation in this format:\n"
        f"   word1 (translation1)\n"
        f"   word2 (translation2)\n"
        f"   ...\n\n"
        f"2. Full translation: Provide a complete, fluent English translation of the entire text.\n\n"
        f"Sanskrit text: {words_text}\n\n"
        f"Format your response as follows:\n"
        f"WORD_BY_WORD:\n"
        f"word1 (translation1)\n"
        f"word2 (translation2)\n"
        f"...\n\n"
        f"FULL_TRANSLATION:\n"
        f"[complete English translation here]"
    )
    
    # Make API call
    response_text = make_openai_request(
        api_key=api_key,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model,
        temperature=0.3,
        max_tokens=1000
    )
    
    # Parse the response to extract both parts
    word_translations, full_translation = parse_combined_translation_response(
        response_text, devanagari_words
    )
    
    return word_translations, full_translation

