"""
OpenAI API client for translation requests.

Handles API communication and request/response processing.
"""

import json
from typing import Dict, Any
import requests


OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o"


def make_openai_request(
    api_key: str,
    system_prompt: str,
    user_prompt: str,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.3,
    max_tokens: int = 1000
) -> str:
    """
    Make a request to OpenAI API and return the response text.
    
    Args:
        api_key: OpenAI API key
        system_prompt: System prompt for the API
        user_prompt: User prompt for the API
        model: OpenAI model to use
        temperature: Temperature for the API call
        max_tokens: Maximum tokens for the response (uses max_completion_tokens for newer models)
        
    Returns:
        Response text from OpenAI
        
    Raises:
        ValueError: If API key is missing or API call fails
        requests.RequestException: If HTTP request fails
    """
    if not api_key:
        raise ValueError("OpenAI API key is required")
    
    # Newer models (gpt-5.x, o1, etc.) use max_completion_tokens instead of max_tokens
    # Check if model requires max_completion_tokens
    requires_max_completion_tokens = (
        model.startswith('gpt-5') or 
        model.startswith('o1') or
        'max_completion_tokens' in model.lower()
    )
    
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": temperature
    }
    
    # Use the appropriate parameter based on model
    if requires_max_completion_tokens:
        payload["max_completion_tokens"] = max_tokens
    else:
        payload["max_tokens"] = max_tokens
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            OPENAI_CHAT_URL,
            json=payload,
            headers=headers,
            timeout=30
        )
        
        # Get error details if request failed
        if not response.ok:
            try:
                error_data = response.json()
                error_msg = error_data.get('error', {}).get('message', response.text)
                raise ValueError(f"OpenAI API error ({response.status_code}): {error_msg}")
            except json.JSONDecodeError:
                raise ValueError(f"OpenAI API request failed ({response.status_code}): {response.text}")
        
        response.raise_for_status()
        
        data = response.json()
        
        if "error" in data:
            raise ValueError(f"OpenAI API error: {data['error']}")
        
        if "choices" not in data or len(data["choices"]) == 0:
            raise ValueError("OpenAI response missing choices")
        
        return data["choices"][0]["message"]["content"].strip()
        
    except requests.exceptions.RequestException as e:
        raise ValueError(f"OpenAI API request failed: {e}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse OpenAI response: {e}")

