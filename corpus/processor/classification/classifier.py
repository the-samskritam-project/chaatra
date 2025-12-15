"""Text classification utilities for verse labeling."""

from typing import Optional

from langchain_openai import ChatOpenAI

from processor.classification.constants import ALLOWED_LABELS, PROMPT_TEMPLATE


def classify_text(llm: ChatOpenAI, translation: str) -> str:
    """Return a normalized label from the LLM response."""
    prompt = PROMPT_TEMPLATE.format(full_translation=translation.strip())
    response = llm.invoke(prompt)
    raw = getattr(response, "content", "") or ""
    normalized = raw.strip().lower().splitlines()[0] if raw else ""

    for label in ALLOWED_LABELS:
        if label == normalized:
            return label
    for label in ALLOWED_LABELS:
        if label in normalized:
            return label
    return normalized or "unknown"
