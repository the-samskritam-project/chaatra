#!/usr/bin/env python3
"""Summarize Bhagavad Gita chapters with an LLM.

For each chapter, reads every original verse, calls an LLM once to produce
a short chapter title, a paragraph summary, and an ordered list of key
sections (each with title + verse range + short summary), and writes the
result back to the `chapters_metadata` collection.
"""

import json
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from pymongo.errors import ConnectionFailure
except ImportError:  # pragma: no cover - install-time fallback
    ConnectionFailure = Exception  # type: ignore

from langchain_core.messages import HumanMessage, SystemMessage

from processor.classification.llm_client import build_llm
from processor.utils.mongodb_utils import connect_mongodb


# Traditional short English names — mirrors the frontend constants in
# frontend/src/components/bhagavad_gita/chapterNames.js. Used in the prompt
# so the LLM has an anchor for each chapter beyond just the number.
TRADITIONAL_NAMES: Dict[int, str] = {
    1: "Arjuna's Despair",
    2: "Sankhya Yoga",
    3: "Karma Yoga",
    4: "Knowledge & Action",
    5: "Renunciation",
    6: "Meditation",
    7: "Knowledge",
    8: "Imperishable",
    9: "Royal Secret",
    10: "Glories",
    11: "Universal Form",
    12: "Devotion",
    13: "Field & Knower",
    14: "Three Gunas",
    15: "Supreme Person",
    16: "Divine & Demonic",
    17: "Three Faiths",
    18: "Liberation",
}


SYSTEM_PROMPT = """You are a Sanskrit philosophy scholar specializing in the Bhagavad Gita.
Your task is to read a complete chapter and produce a concise overview
for a reader who is about to study the chapter.
- Stay faithful to the verses you are given. Do not introduce content
  from general knowledge that isn't supported by the verses.
- Be concise. Aim for short, scannable text.
- Each key section must cover a contiguous run of verses, and its
  start_verse/end_verse MUST appear in the verse list you were given.
- Return only valid JSON. No preamble, no markdown fences."""


USER_PROMPT_TEMPLATE = """Chapter {chapter_number} (traditional short name: {short_name})

Below are the original verses of this chapter, one per line, formatted as
"<verse_number>: <iast or devanagari>" optionally followed by " | en: <english translation>".

{verses_block}

Task:
1. Produce a `title` (max 8 words) capturing the chapter's central idea.
2. Produce a `summary` paragraph (2-4 sentences) that orients a first-time
   reader to what unfolds in this chapter.
3. Produce a `key_sections` array. Each section must have:
   - "title": a short noun phrase (max 6 words)
   - "start_verse": the first verse number it covers (e.g. "1.1")
   - "end_verse": the last verse number it covers (e.g. "1.11")
   - "summary": one or two sentences describing the section
   Sections should cover the chapter in order, with no gaps or overlap.
   Use 3-6 sections.

Return JSON in exactly this format:
{{
  "title": "...",
  "summary": "...",
  "key_sections": [
    {{"title": "...", "start_verse": "...", "end_verse": "...", "summary": "..."}}
  ]
}}"""


def discover_chapter_collections(db) -> List[int]:
    """Return chapter numbers for all `chapter_N` collections present."""
    chapter_numbers: List[int] = []
    for name in db.list_collection_names():
        m = re.match(r"chapter_(\d+)$", name)
        if m:
            chapter_numbers.append(int(m.group(1)))
    chapter_numbers.sort()
    return chapter_numbers


def _build_verses_block(verses: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for v in verses:
        vn = v.get("verse_number", "")
        text = v.get("original_iast") or v.get("transliterated_devanagari") or ""
        en = v.get("full_translation") or ""
        line = f"{vn}: {text}"
        if en:
            line += f" | en: {en}"
        lines.append(line)
    return "\n".join(lines)


def _parse_response(raw: str) -> Optional[Dict[str, Any]]:
    """Strip optional markdown fences, parse JSON, return dict or None."""
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _validate(data: Dict[str, Any], valid_verse_numbers: set) -> Optional[str]:
    """Return None if valid, otherwise a short reason string."""
    if not isinstance(data, dict):
        return "response is not a JSON object"
    title = data.get("title")
    summary = data.get("summary")
    sections = data.get("key_sections")
    if not isinstance(title, str) or not title.strip():
        return "title missing or empty"
    if not isinstance(summary, str) or not summary.strip():
        return "summary missing or empty"
    if not isinstance(sections, list) or not sections:
        return "key_sections missing or empty"
    for i, sec in enumerate(sections):
        if not isinstance(sec, dict):
            return f"section[{i}] is not an object"
        for f in ("title", "start_verse", "end_verse", "summary"):
            val = sec.get(f)
            if not isinstance(val, str) or not val.strip():
                return f"section[{i}].{f} missing or empty"
        if sec["start_verse"] not in valid_verse_numbers:
            return f"section[{i}].start_verse {sec['start_verse']!r} not present in chapter"
        if sec["end_verse"] not in valid_verse_numbers:
            return f"section[{i}].end_verse {sec['end_verse']!r} not present in chapter"
    return None


def summarize_chapter(
    llm, chapter_num: int, verses: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """One LLM call for a chapter; returns the validated dict or None."""
    verses_block = _build_verses_block(verses)
    short_name = TRADITIONAL_NAMES.get(chapter_num, f"Chapter {chapter_num}")
    user_msg = USER_PROMPT_TEMPLATE.format(
        chapter_number=chapter_num,
        short_name=short_name,
        verses_block=verses_block,
    )
    try:
        resp = llm.invoke(
            [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=user_msg),
            ]
        )
    except Exception as e:
        print(f"    ⚠ LLM error: {e}")
        return None

    data = _parse_response(getattr(resp, "content", ""))
    if data is None:
        print("    ⚠ Failed to parse LLM response as JSON")
        return None

    valid_verse_numbers = {v.get("verse_number", "") for v in verses}
    err = _validate(data, valid_verse_numbers)
    if err:
        print(f"    ⚠ Validation failed: {err}")
        return None
    return data


def summarize_bhagavad_gita_chapters(
    mongodb_uri: str,
    database_name: str,
    *,
    start_chapter: Optional[int] = None,
    end_chapter: Optional[int] = None,
    api_key: Optional[str] = None,
    model: str = "gpt-5.1",
    delay: float = 1.0,
    force: bool = False,
) -> None:
    """Loop chapters and write title/summary/key_sections to chapters_metadata."""
    print("Bhagavad Gita Chapter Summarization")
    print("=" * 60)
    print(f"Database: {database_name}")
    if start_chapter or end_chapter:
        print(f"Chapter range: {start_chapter or 1} - {end_chapter or 'end'}")
    else:
        print("Chapter range: All chapters")
    print(f"Model: {model}")
    print(f"Delay: {delay} seconds")
    print(f"Force: {force}")
    print("=" * 60)

    print("\nConnecting to MongoDB...")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
    except ConnectionFailure as e:
        print(f"Error: {e}")
        return

    chapter_numbers = discover_chapter_collections(db)
    if not chapter_numbers:
        print("Error: No chapter collections found (expected pattern: chapter_N)")
        client.close()
        return

    if start_chapter is not None:
        chapter_numbers = [c for c in chapter_numbers if c >= start_chapter]
    if end_chapter is not None:
        chapter_numbers = [c for c in chapter_numbers if c <= end_chapter]

    if not chapter_numbers:
        print(f"No chapters in range {start_chapter}-{end_chapter}")
        client.close()
        return

    print(f"✓ Found {len(chapter_numbers)} chapter(s) to process")

    print(f"\nInitializing OpenAI model: {model}")
    try:
        llm = build_llm(model=model, api_key=api_key)
    except Exception as e:
        print(f"Error initializing LLM: {e}")
        client.close()
        return

    meta = db["chapters_metadata"]
    totals = {"processed": 0, "summarized": 0, "skipped": 0, "errors": 0}

    for n in chapter_numbers:
        totals["processed"] += 1
        print(f"\nChapter {n}")
        print("-" * 60)

        meta_doc = meta.find_one({"chapter_number": n})
        if meta_doc is None:
            print(f"  ⊘ no chapters_metadata document for chapter {n}; skipping")
            totals["skipped"] += 1
            continue

        if not force and meta_doc.get("summary"):
            print("  ⊘ already summarised (use --summary-force to regenerate)")
            totals["skipped"] += 1
            continue

        verses = list(
            db[f"chapter_{n}"]
            .find({"type": "original_verse"})
            .sort("verse_index", 1)
        )
        if not verses:
            print("  ⊘ no verses found in chapter collection")
            totals["skipped"] += 1
            continue

        print(f"  → {len(verses)} verses; calling LLM...", flush=True)
        data = summarize_chapter(llm, n, verses)
        if data is None:
            totals["errors"] += 1
            continue

        meta.update_one(
            {"chapter_number": n},
            {
                "$set": {
                    "title": data["title"],
                    "summary": data["summary"],
                    "key_sections": data["key_sections"],
                    "summary_model": model,
                    "summarized_at": datetime.utcnow(),
                }
            },
            upsert=False,
        )
        totals["summarized"] += 1
        print(f"  ✓ {data['title']} ({len(data['key_sections'])} sections)")

        if delay > 0:
            time.sleep(delay)

    print("\n" + "=" * 60)
    print(
        f"Totals: processed={totals['processed']}, "
        f"summarized={totals['summarized']}, "
        f"skipped={totals['skipped']}, "
        f"errors={totals['errors']}"
    )
    client.close()
