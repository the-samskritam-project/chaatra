"""LLM client factory for classification."""

from typing import Optional

from langchain_openai import ChatOpenAI


def build_llm(model: str, api_key: Optional[str]) -> ChatOpenAI:
    """Create a deterministic ChatOpenAI client."""
    return ChatOpenAI(model=model, temperature=0, openai_api_key=api_key)
