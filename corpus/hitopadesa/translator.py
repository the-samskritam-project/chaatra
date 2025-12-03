#!/usr/bin/env python3
"""
OpenAI-based translator for Devanagari Sanskrit text.

Provides word-by-word translation functionality using OpenAI API.
"""

import json
import os
import re
import time
from typing import List, Dict, Optional, Tuple
import requests


OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"


def split_devanagari_words(text: str) -> List[str]:
    """
    Split Devanagari text into individual words.
    
    Handles punctuation, spaces, and common separators.
    
    Args:
        text: Devanagari text string
        
    Returns:
        List of words (may include punctuation as separate items)
    """
    # Remove extra whitespace
    text = text.strip()
    
    # Split by spaces, but preserve punctuation markers like |
    # We'll keep punctuation separate for now
    words = []
    current_word = []
    
    for char in text:
        # Devanagari Unicode range: \u0900-\u097F
        if '\u0900' <= char <= '\u097F':
            current_word.append(char)
        elif char in ' \n\t':
            if current_word:
                words.append(''.join(current_word))
                current_word = []
        elif char in '|':
            # Keep punctuation as separate item
            if current_word:
                words.append(''.join(current_word))
                current_word = []
            words.append(char)
        else:
            # Other characters (like hyphens in compound words)
            if current_word:
                words.append(''.join(current_word))
                current_word = []
            if char.strip():  # Only add non-whitespace
                words.append(char)
    
    # Add any remaining word
    if current_word:
        words.append(''.join(current_word))
    
    # Filter out empty strings
    words = [w for w in words if w.strip()]
    
    return words


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
        model: OpenAI model to use (default: gpt-4o-mini)
        
    Returns:
        List of dictionaries with 'word' and 'translation' keys
        
    Raises:
        ValueError: If API key is missing or API call fails
        requests.RequestException: If HTTP request fails
    """
    if not api_key:
        raise ValueError("OpenAI API key is required")
    
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
    
    # Prepare API request
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 1000
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Make API call
    try:
        response = requests.post(
            OPENAI_CHAT_URL,
            json=payload,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        
        data = response.json()
        
        if "error" in data:
            raise ValueError(f"OpenAI API error: {data['error']}")
        
        if "choices" not in data or len(data["choices"]) == 0:
            raise ValueError("OpenAI response missing choices")
        
        translation_text = data["choices"][0]["message"]["content"].strip()
        
        # Parse the translation response
        translations = parse_translation_response(translation_text, devanagari_words)
        
        return translations
        
    except requests.exceptions.RequestException as e:
        raise ValueError(f"OpenAI API request failed: {e}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse OpenAI response: {e}")


def parse_translation_response(
    response_text: str, 
    original_words: List[str]
) -> List[Dict[str, str]]:
    """
    Parse OpenAI translation response into word-translation pairs.
    
    Args:
        response_text: Raw response from OpenAI
        original_words: List of original Devanagari words
        
    Returns:
        List of dictionaries with 'word' and 'translation' keys
    """
    translations = []
    
    # Split by lines first
    lines = response_text.split('\n')
    
    # Build a mapping from response - try multiple patterns
    word_translation_map = {}
    translation_list = []  # Ordered list to preserve sequence
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Pattern 1: word (translation)
        match = re.search(r'([\u0900-\u097F]+)\s*[\(:]\s*([^\)]+)', line)
        if match:
            word = match.group(1)
            translation = match.group(2).strip().rstrip(')').strip()
            word_translation_map[word] = translation
            translation_list.append((word, translation))
            continue
        
        # Pattern 2: word - translation
        parts = re.split(r'\s*[-:]\s+', line, 1)
        if len(parts) == 2:
            word = parts[0].strip()
            translation = parts[1].strip()
            if word and any('\u0900' <= c <= '\u097F' for c in word):
                word_translation_map[word] = translation
                translation_list.append((word, translation))
                continue
        
        # Pattern 3: Just word and translation separated by space (if word is Devanagari)
        parts = line.split(None, 1)
        if len(parts) == 2:
            word = parts[0].strip()
            translation = parts[1].strip()
            if word and any('\u0900' <= c <= '\u097F' for c in word):
                word_translation_map[word] = translation
                translation_list.append((word, translation))
    
    # Match original words with translations in order
    # Use the ordered list if available, otherwise use the map
    if translation_list and len(translation_list) == len(original_words):
        # Perfect match - use ordered list
        for i, word in enumerate(original_words):
            if i < len(translation_list):
                resp_word, translation = translation_list[i]
                # Verify it's the same word or close match
                if word == resp_word or word in resp_word or resp_word in word:
                    translations.append({
                        "word": word,
                        "translation": translation
                    })
                else:
                    translations.append({
                        "word": word,
                        "translation": word_translation_map.get(word, "")
                    })
            else:
                translations.append({
                    "word": word,
                    "translation": word_translation_map.get(word, "")
                })
    else:
        # Fallback: match by word
        for word in original_words:
            # Try exact match first
            if word in word_translation_map:
                translations.append({
                    "word": word,
                    "translation": word_translation_map[word]
                })
            else:
                # Try partial match
                found = False
                for resp_word, translation in word_translation_map.items():
                    if word in resp_word or resp_word in word:
                        translations.append({
                            "word": word,
                            "translation": translation
                        })
                        found = True
                        break
                
                if not found:
                    # If we can't find a match, add with empty translation
                    translations.append({
                        "word": word,
                        "translation": ""
                    })
    
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
        model: OpenAI model to use (default: gpt-4o-mini)
        
    Returns:
        Full English translation of the text
        
    Raises:
        ValueError: If API key is missing or API call fails
        requests.RequestException: If HTTP request fails
    """
    if not api_key:
        raise ValueError("OpenAI API key is required")
    
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
    
    # Prepare API request
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 500
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Make API call
    try:
        response = requests.post(
            OPENAI_CHAT_URL,
            json=payload,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        
        data = response.json()
        
        if "error" in data:
            raise ValueError(f"OpenAI API error: {data['error']}")
        
        if "choices" not in data or len(data["choices"]) == 0:
            raise ValueError("OpenAI response missing choices")
        
        translation = data["choices"][0]["message"]["content"].strip()
        
        return translation
        
    except requests.exceptions.RequestException as e:
        raise ValueError(f"OpenAI API request failed: {e}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse OpenAI response: {e}")


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
        model: OpenAI model to use (default: gpt-4o-mini)
        
    Returns:
        Tuple of (word_by_word_translations, full_translation)
        - word_by_word_translations: List of dicts with 'word' and 'translation' keys
        - full_translation: Complete English translation string
        
    Raises:
        ValueError: If API key is missing or API call fails
        requests.RequestException: If HTTP request fails
    """
    if not api_key:
        raise ValueError("OpenAI API key is required")
    
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
    
    # Prepare API request
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 1000
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Make API call
    try:
        response = requests.post(
            OPENAI_CHAT_URL,
            json=payload,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        
        data = response.json()
        
        if "error" in data:
            raise ValueError(f"OpenAI API error: {data['error']}")
        
        if "choices" not in data or len(data["choices"]) == 0:
            raise ValueError("OpenAI response missing choices")
        
        response_text = data["choices"][0]["message"]["content"].strip()
        
        # Parse the response to extract both parts
        word_translations, full_translation = parse_combined_translation_response(
            response_text, devanagari_words
        )
        
        return word_translations, full_translation
        
    except requests.exceptions.RequestException as e:
        raise ValueError(f"OpenAI API request failed: {e}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse OpenAI response: {e}")


def parse_combined_translation_response(
    response_text: str,
    original_words: List[str]
) -> Tuple[List[Dict[str, str]], str]:
    """
    Parse combined OpenAI response containing both word-by-word and full translation.
    
    Args:
        response_text: Raw response from OpenAI
        original_words: List of original Devanagari words
        
    Returns:
        Tuple of (word_translations, full_translation)
    """
    # Split response into word-by-word and full translation sections
    word_section = ""
    full_translation = ""
    
    # Try to find the sections
    if "WORD_BY_WORD:" in response_text:
        parts = response_text.split("WORD_BY_WORD:", 1)
        if len(parts) > 1:
            remaining = parts[1]
            if "FULL_TRANSLATION:" in remaining:
                word_section, full_translation = remaining.split("FULL_TRANSLATION:", 1)
                full_translation = full_translation.strip()
            else:
                word_section = remaining
    elif "FULL_TRANSLATION:" in response_text:
        parts = response_text.split("FULL_TRANSLATION:", 1)
        if len(parts) > 1:
            full_translation = parts[1].strip()
            # Word-by-word might be before FULL_TRANSLATION
            word_section = parts[0]
    else:
        # Try to infer - look for word-by-word pattern first
        lines = response_text.split('\n')
        word_lines = []
        full_lines = []
        in_word_section = True
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Check if line looks like word-by-word (contains Devanagari)
            if any('\u0900' <= c <= '\u097F' for c in line) and ('(' in line or ':' in line):
                word_lines.append(line)
                in_word_section = True
            elif in_word_section and not any('\u0900' <= c <= '\u097F' for c in line):
                # Transition to full translation
                in_word_section = False
                full_lines.append(line)
            elif not in_word_section:
                full_lines.append(line)
        
        word_section = '\n'.join(word_lines)
        full_translation = '\n'.join(full_lines).strip()
    
    # Parse word-by-word translations
    word_translations = []
    if word_section:
        word_translations = parse_translation_response(word_section, original_words)
    
    # Clean up full translation
    if not full_translation:
        # If we couldn't find a clear full translation, try to extract it
        # Look for longer sentences that don't contain Devanagari
        lines = response_text.split('\n')
        full_lines = []
        for line in lines:
            line = line.strip()
            if line and not any('\u0900' <= c <= '\u097F' for c in line):
                if len(line) > 20:  # Likely a full translation line
                    full_lines.append(line)
        full_translation = ' '.join(full_lines).strip()
    
    return word_translations, full_translation

