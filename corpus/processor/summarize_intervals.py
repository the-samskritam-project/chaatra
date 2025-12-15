"""
Summarize intervals and extract thematic labels via LangChain + OpenAI.

For each interval in {corpus}_intervals (default), fetch member items'
full translations, produce a concise summary plus 3-5 thematic labels,
and write back to the interval document.
"""

import json
import re
import time
from typing import List, Optional, Dict, Any

try:
    from pymongo.errors import ConnectionFailure
except ImportError:
    ConnectionFailure = Exception  # type: ignore

from langchain_openai import ChatOpenAI
from processor.utils.mongodb_utils import connect_mongodb
from processor.classification.mongo_utils import chapter_collections

PROMPT_TEMPLATE = """You are given an interval of a Sanskrit story with its English translations.
Summarize the interval and extract thematic labels (not the narrative-function labels).

Provide ONLY JSON (no markdown, no code fences, no prose), with keys:
- summary: 2-4 sentences, concise, capturing key actions/ideas.
- themes: 3-5 concise thematic labels (lowercase, dash-separated if multiword), reflecting motifs, topics, or situational themes (e.g., loyalty, betrayal, cleverness, caution, fate, royal-counsel, friendship, deception, greed, duty, karma).

Rules:
- Output must be plain JSON, no ``` fences or extra text.
- Base everything only on the provided text.
- Do not invent missing context.
- Keep themes short (1-3 words), lowercase.
- If little content, summarize what is given and pick minimal themes.

Text:
{interval_text}
"""


def summarize_intervals(
    corpus_name: str,
    mongodb_uri: str,
    database_name: Optional[str] = None,
    intervals_collection: Optional[str] = None,
    label_field: str = "narrative_label",
    start_chapter: Optional[int] = None,
    end_chapter: Optional[int] = None,
    max_intervals: Optional[int] = None,
    batch_size: int = 5,
    force: bool = False,
    delay: float = 0.0,
    api_key: Optional[str] = None,
    model: str = "gpt-4o",
):
    db, client = connect_mongodb(mongodb_uri, database_name or corpus_name)
    intervals_coll = db[intervals_collection or f"{corpus_name}_intervals"]

    try:
        llm = ChatOpenAI(model=model, temperature=0, openai_api_key=api_key)

        # Determine chapters to consider based on available chapter collections
        chapter_lookup = dict(chapter_collections(db.list_collection_names(), corpus_name, None, None))

        query: Dict[str, Any] = {}
        if start_chapter is not None or end_chapter is not None:
            query["chapter_number"] = {}
            if start_chapter is not None:
                query["chapter_number"]["$gte"] = start_chapter
            if end_chapter is not None:
                query["chapter_number"]["$lte"] = end_chapter

        cursor = intervals_coll.find(query).sort([("chapter_number", 1), ("interval_index", 1)])
        if max_intervals:
            cursor = cursor.limit(max_intervals)

        intervals = list(cursor)
        total = len(intervals)
        print(f"Loaded {total} intervals to summarize")

        processed = 0
        for batch_start in range(0, total, batch_size):
            batch = intervals[batch_start : batch_start + batch_size]
            for interval_doc in batch:
                processed += 1

                if not force and interval_doc.get("interval_summary") and interval_doc.get("interval_themes"):
                    print(f"⊘ Skip interval {interval_doc.get('_id')} (already summarized)")
                    continue

                text = _build_interval_text(db, corpus_name, chapter_lookup, interval_doc)
                if not text:
                    print(f"⚠ Interval {interval_doc.get('_id')} has no text; skipping")
                    continue

                prompt = PROMPT_TEMPLATE.format(interval_text=text)
                try:
                    resp = llm.invoke(prompt)
                    content = getattr(resp, "content", "") or ""
                    summary, themes = _parse_response(content)
                except Exception as exc:
                    print(f"✗ Error summarizing interval {interval_doc.get('_id')}: {exc}")
                    continue

                if not summary or not themes:
                    print(f"⚠ Parsed empty summary/themes for interval {interval_doc.get('_id')}, skipping update")
                    continue

                intervals_coll.update_one(
                    {"_id": interval_doc.get("_id")},
                    {
                        "$set": {
                            "interval_summary": summary,
                            "interval_themes": themes,
                            "interval_summary_model": model,
                        }
                    },
                )
                print(f"✓ Interval {interval_doc.get('_id')} summarized ({processed}/{total})")

                if delay:
                    time.sleep(delay)

        print("\n=== Interval Summaries Complete ===")
        print(f"Total intervals processed: {processed}")

    except ConnectionFailure as e:
        print(f"Error connecting to MongoDB: {e}")
        raise
    finally:
        client.close()
        print("\n✓ Summarization run complete")


def _build_interval_text(db, corpus_name: str, chapter_lookup: Dict[int, str], interval_doc: Dict[str, Any]) -> str:
    chapter_number = interval_doc.get("chapter_number")
    coll_name = chapter_lookup.get(chapter_number)
    if not coll_name:
        return ""
    coll = db[coll_name]
    item_ids = interval_doc.get("item_ids") or []
    if not item_ids:
        return ""

    # Preserve order based on stored item_ids
    texts = []
    for item_id in item_ids:
        doc = coll.find_one({"_id": item_id})
        if doc and doc.get("full_translation"):
            texts.append(doc["full_translation"])
    return "\n\n".join(texts)


def _parse_response(content: str):
    raw = content.strip()
    # strip code fences if present
    raw = re.sub(r"^```\\w*\\s*", "", raw)
    raw = re.sub(r"```\\s*$", "", raw)

    # extract JSON between first { and last }
    if "{" in raw and "}" in raw:
        raw = raw[raw.find("{"): raw.rfind("}") + 1]

    data = json.loads(raw)
    summary = str(data.get("summary", "")).strip()
    themes = data.get("themes", [])
    if isinstance(themes, str):
        themes = [themes]
    themes = [t.strip().lower() for t in themes if t and isinstance(t, str)]
    return summary, themes
