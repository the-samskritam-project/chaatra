"""
Build chapter intervals by splitting on transition-labeled documents.

Rules:
- Documents with label == "transition" end the current interval (and belong to it).
- The next interval starts after the transition document.
- Unlabeled docs are treated as non-transition.
- By default, all doc types are included; optionally restrict to verses only.
"""

from typing import List, Optional, Tuple, Dict, Any

try:
    from pymongo.errors import ConnectionFailure
    from pymongo import UpdateOne
except ImportError:
    ConnectionFailure = Exception  # type: ignore
    UpdateOne = None  # type: ignore

from processor.utils.mongodb_utils import connect_mongodb
from processor.utils.item_utils import sort_items
from processor.classification.mongo_utils import chapter_collections


def build_intervals(
    corpus_name: str,
    mongodb_uri: str,
    database_name: Optional[str] = None,
    output_collection: Optional[str] = None,
    label_field: str = "narrative_label",
    start_chapter: Optional[int] = None,
    end_chapter: Optional[int] = None,
    max_per_chapter: Optional[int] = None,
    verses_only: bool = False,
):
    """
    Build intervals for a corpus by splitting on transition labels.
    """
    db, client = connect_mongodb(mongodb_uri, database_name or corpus_name)
    target_collection = output_collection or f"{corpus_name}_intervals"

    try:
        collections = chapter_collections(
            db.list_collection_names(),
            corpus_name=corpus_name,
            start_chapter=start_chapter,
            end_chapter=end_chapter,
        )
        if not collections:
            print("No matching chapter collections found.")
            return

        total_intervals = 0
        for chapter_num, coll_name in collections:
            source_coll = db[coll_name]
            interval_count = _process_chapter(
                source_coll=source_coll,
                target_coll=db[target_collection],
                corpus_name=corpus_name,
                chapter_number=chapter_num,
                label_field=label_field,
                max_docs=max_per_chapter,
                verses_only=verses_only,
            )
            total_intervals += interval_count
            print(
                f"Chapter {chapter_num} ({coll_name}) -> "
                f"{interval_count} intervals (target: {target_collection})"
            )

        print("\n=== Interval Build Summary ===")
        print(f"Corpus: {corpus_name}")
        print(f"Database: {database_name or corpus_name}")
        print(f"Output collection: {target_collection}")
        print(f"Total intervals: {total_intervals}")
    except ConnectionFailure as e:
        print(f"Error connecting to MongoDB: {e}")
        raise
    finally:
        client.close()
        print("\n✓ Interval build complete")


def _process_chapter(
    source_coll,
    target_coll,
    corpus_name: str,
    chapter_number: int,
    label_field: str,
    max_docs: Optional[int],
    verses_only: bool,
) -> int:
    cursor_filter: Dict[str, Any] = {}
    if verses_only:
        cursor_filter = {"type": "verse"}

    cursor = source_coll.find(cursor_filter)
    if max_docs:
        cursor = cursor.limit(max_docs)

    docs = list(cursor)
    docs = sort_items(docs)

    intervals = []
    current: List[Dict[str, Any]] = []
    interval_index = 1

    for doc in docs:
        current.append(doc)
        label = (doc.get(label_field) or "").strip().lower()
        is_transition = label == "transition"

        if is_transition:
            intervals.append(_make_interval_doc(current, corpus_name, chapter_number, interval_index, label_field))
            interval_index += 1
            current = []

    if current:
        intervals.append(_make_interval_doc(current, corpus_name, chapter_number, interval_index, label_field))

    _write_intervals(target_coll, intervals)
    return len(intervals)


def _make_interval_doc(items: List[Dict[str, Any]], corpus_name: str, chapter_number: int, idx: int, label_field: str):
    start = items[0]
    end = items[-1]
    verse_numbers = [it.get("verse_number") for it in items if it.get("verse_number")]
    prose_numbers = [it.get("prose_number") for it in items if it.get("prose_number")]
    labels = [it.get(label_field) for it in items]

    return {
        "corpus_name": corpus_name,
        "chapter_number": chapter_number,
        "interval_index": idx,
        "start_id": start.get("_id"),
        "end_id": end.get("_id"),
        "verse_numbers": verse_numbers,
        "prose_numbers": prose_numbers,
        "item_ids": [it.get("_id") for it in items],
        "labels": labels,
        "count": len(items),
    }


def _write_intervals(target_coll, intervals: List[Dict[str, Any]]):
    if not intervals:
        return
    try:
        target_coll.insert_many(intervals)
    except Exception as exc:
        print(f"  ⚠ error writing intervals: {exc}")
