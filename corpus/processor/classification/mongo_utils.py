"""Mongo helpers for verse classification."""

import re
from typing import Iterable, List, Optional, Tuple


def chapter_collections(
    collection_names: Iterable[str],
    corpus_name: str,
    start_chapter: Optional[int],
    end_chapter: Optional[int],
) -> List[Tuple[int, str]]:
    prefix = f"{corpus_name}_chapter_"
    results: List[Tuple[int, str]] = []
    for name in collection_names:
        if not name.startswith(prefix):
            continue
        suffix = name[len(prefix):]
        match = re.fullmatch(r"(\d+)", suffix)
        if not match:
            continue
        chap_num = int(match.group(1))
        if start_chapter is not None and chap_num < start_chapter:
            continue
        if end_chapter is not None and chap_num > end_chapter:
            continue
        results.append((chap_num, name))
    results.sort(key=lambda x: x[0])
    return results


def write_label(collection, doc_id, label_field: str, label: str, model: str):
    collection.update_one(
        {"_id": doc_id},
        {"$set": {label_field: label, "label_model": model}},
    )
