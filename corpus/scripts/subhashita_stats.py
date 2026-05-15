#!/usr/bin/env python3
"""Quick stats on the subhashita translation enrichment progress.

Counts how many documents in the mahasubhasitasamgraha collection have
the LLM-generated translation fields filled in, and breaks down by the
model that wrote them.

Usage:
    cd corpus
    source .venv/bin/activate
    python scripts/subhashita_stats.py
"""

import os
import sys

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from pymongo import MongoClient


def main() -> int:
    if load_dotenv:
        load_dotenv(os.path.join(os.path.dirname(__file__), os.pardir, ".env"))

    uri = os.getenv("MONGODB_URI")
    if not uri:
        print("Error: MONGODB_URI not set")
        return 1

    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    coll = client["subhashita"]["mahasubhasitasamgraha"]

    total = coll.count_documents({})
    enriched = coll.count_documents(
        {"translation_model": {"$exists": True, "$nin": ["", None]}}
    )
    pending = total - enriched
    pct = (enriched / total * 100) if total else 0.0

    print(f"Total subhashitas:   {total}")
    print(f"Enriched (translated): {enriched}   ({pct:.1f}%)")
    print(f"Pending:             {pending}")

    print("\nBreakdown by model:")
    models = coll.distinct("translation_model")
    for m in sorted(models, key=lambda x: x or ""):
        if not m:
            continue
        c = coll.count_documents({"translation_model": m})
        print(f"  {m:20s} {c}")

    # Sanity check: do enriched docs actually have all the fields?
    print("\nField coverage on enriched docs:")
    for field in (
        "full_translation",
        "split_shloka",
        "split_word_by_word_translation",
        "primary_theme",
        "secondary_themes",
    ):
        c = coll.count_documents(
            {
                "translation_model": {"$exists": True, "$nin": ["", None]},
                field: {"$exists": True, "$nin": ["", None, []]},
            }
        )
        print(f"  {field:35s} {c}/{enriched}")

    print("\nTop primary themes:")
    primary_pipeline = [
        {"$match": {"primary_theme": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": "$primary_theme", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 25},
    ]
    for doc in coll.aggregate(primary_pipeline):
        print(f"  {doc['count']:5d}  {doc['_id']}")

    print("\nTop secondary themes (across all secondary_themes entries):")
    secondary_pipeline = [
        {"$match": {"secondary_themes": {"$exists": True, "$ne": []}}},
        {"$unwind": "$secondary_themes"},
        {"$group": {"_id": "$secondary_themes", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 25},
    ]
    for doc in coll.aggregate(secondary_pipeline):
        print(f"  {doc['count']:5d}  {doc['_id']}")

    # Distinct counts give us a sense of taxonomy sprawl
    primary_distinct = len(coll.distinct("primary_theme")) - (
        1 if "" in coll.distinct("primary_theme") else 0
    )
    secondary_distinct = len(coll.distinct("secondary_themes"))
    print(f"\nDistinct primary themes: {primary_distinct}")
    print(f"Distinct secondary themes: {secondary_distinct}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
