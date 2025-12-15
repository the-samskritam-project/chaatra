"""
Classify verses by narrative function using LangChain + OpenAI."""

import time
from typing import List, Optional

try:
    from pymongo.errors import ConnectionFailure
    from pymongo import UpdateOne
except ImportError:
    ConnectionFailure = Exception  # Fallback type hint if pymongo not installed
    UpdateOne = None  # type: ignore

from processor.classification.classifier import classify_text
from processor.classification.llm_client import build_llm
from processor.classification.mongo_utils import chapter_collections, write_label
from processor.utils.mongodb_utils import connect_mongodb


def classify_verses(
    corpus_name: str,
    mongodb_uri: str,
    database_name: Optional[str] = None,
    label_field: str = "narrative_label",
    start_chapter: Optional[int] = None,
    end_chapter: Optional[int] = None,
    max_per_chapter: Optional[int] = None,
    force: bool = False,
    api_key: Optional[str] = None,
    model: str = "gpt-4o",
    delay: float = 0.0,
):
    """Classify verses in chapter collections and write labels back to MongoDB."""
    db, client = connect_mongodb(mongodb_uri, database_name or corpus_name)
    try:
        llm = build_llm(model=model, api_key=api_key)
        collections = chapter_collections(
            db.list_collection_names(),
            corpus_name=corpus_name,
            start_chapter=start_chapter,
            end_chapter=end_chapter,
        )
        if not collections:
            print("No matching chapter collections found.")
            return

        totals = {"processed": 0, "labeled": 0, "skipped": 0}

        for chapter_num, coll_name in collections:
            chapter_totals = _process_chapter(
                collection=db[coll_name],
                llm=llm,
                label_field=label_field,
                force=force,
                max_docs=max_per_chapter,
                delay=delay,
                model=model,
                totals=totals,
            )
            print(
                f"\nChapter {chapter_num} ({coll_name}): "
                f"processed={chapter_totals['processed']}, "
                f"labeled={chapter_totals['labeled']}, "
                f"skipped={chapter_totals['skipped']}"
            )

        print("\n=== Classification Summary ===")
        print(f"Corpus: {corpus_name}")
        print(f"Database: {database_name or corpus_name}")
        print(f"Label field: {label_field}")
        print(f"Total processed: {totals['processed']}")
        print(f"Total labeled: {totals['labeled']}")
        print(f"Total skipped: {totals['skipped']}")
    except ConnectionFailure as e:
        print(f"Error connecting to MongoDB: {e}")
        raise
    finally:
        client.close()
        print("\n✓ Classification complete")


def _process_chapter(
    collection,
    llm,
    label_field: str,
    force: bool,
    max_docs: Optional[int],
    delay: float,
    model: str,
    totals: dict,
) -> dict:
    cursor = collection.find({})
    if max_docs:
        cursor = cursor.limit(max_docs)

    chapter_totals = {"processed": 0, "labeled": 0, "skipped": 0}
    pending_ops: List = []

    for doc in cursor:
        chapter_totals["processed"] += 1
        totals["processed"] += 1

        if not force and doc.get(label_field):
            chapter_totals["skipped"] += 1
            totals["skipped"] += 1
            continue

        translation = doc.get("full_translation")
        if not translation:
            chapter_totals["skipped"] += 1
            totals["skipped"] += 1
            continue

        label = classify_text(llm, translation)
        ident = doc.get("verse_number") or doc.get("prose_number") or doc.get("_id")
        print(f"  ✓ {ident} -> {label}")

        if UpdateOne:
            pending_ops.append(
                UpdateOne(
                    {"_id": doc["_id"]},
                    {"$set": {label_field: label, "label_model": model}},
                )
            )
            if len(pending_ops) >= 10:
                _flush_ops(collection, pending_ops)
                pending_ops = []
        else:
            # Fallback to direct write if pymongo bulk helpers unavailable
            write_label(collection, doc["_id"], label_field, label, model)

        chapter_totals["labeled"] += 1
        totals["labeled"] += 1

        if delay:
            time.sleep(delay)

    if pending_ops:
        _flush_ops(collection, pending_ops)

    return chapter_totals


def _flush_ops(collection, ops: List):
    try:
        print(f"  ↻ writing batch of {len(ops)} labels...")
        collection.bulk_write(ops, ordered=False)
        print(f"  ✓ batch persisted ({len(ops)})")
    except Exception as exc:  # keep classification running even if a batch fails
        print(f"  ⚠ bulk write error ({len(ops)} ops): {exc}")
