"""
Create interval theme documents from intervals collection.

Reads from {corpus}_intervals and creates derived documents in
{corpus}_interval_theme_docs with embedding_text constructed from
interval_themes and interval_summary.
"""

from typing import Optional, Dict, Any, List

try:
    from pymongo.errors import ConnectionFailure
    from pymongo import UpdateOne
except ImportError:
    ConnectionFailure = Exception  # type: ignore
    UpdateOne = None  # type: ignore

from processor.utils.mongodb_utils import connect_mongodb


def create_interval_theme_docs(
    corpus_name: str,
    mongodb_uri: str,
    database_name: Optional[str] = None,
    intervals_collection: Optional[str] = None,
    require_summarized: bool = False,
    batch_size: int = 100,
):
    """
    Create interval theme documents from intervals collection.
    
    Reads interval documents and creates derived documents with embedding_text
    constructed from interval_themes and interval_summary.
    
    Args:
        corpus_name: Name of the corpus
        mongodb_uri: MongoDB connection URI
        database_name: Database name (defaults to corpus_name)
        intervals_collection: Source collection name (defaults to {corpus}_intervals)
        require_summarized: If True, skip intervals missing interval_summary or interval_themes
        batch_size: Batch size for bulk writes (default: 100)
    """
    db, client = connect_mongodb(mongodb_uri, database_name or corpus_name)
    source_collection = intervals_collection or f"{corpus_name}_intervals"
    target_collection_name = f"{corpus_name}_interval_theme_docs"
    target_collection = db[target_collection_name]

    try:
        # Create unique index on interval_id
        try:
            target_collection.create_index("interval_id", unique=True)
            print(f"✓ Created unique index on interval_id in {target_collection_name}")
        except Exception as e:
            # Index might already exist, which is fine
            print(f"  Note: Index creation: {e}")

        # Read intervals via cursor
        cursor = db[source_collection].find({}).sort([("chapter_number", 1), ("interval_index", 1)])
        
        pending_ops: List[UpdateOne] = []
        processed_count = 0
        skipped_count = 0
        error_count = 0

        for interval_doc in cursor:
            # Check if we should skip this interval
            if require_summarized:
                if not interval_doc.get("interval_summary") or not interval_doc.get("interval_themes"):
                    skipped_count += 1
                    continue

            # Extract fields
            chapter_number = interval_doc.get("chapter_number")
            interval_index = interval_doc.get("interval_index")
            
            if chapter_number is None or interval_index is None:
                print(f"⚠ Skipping interval {interval_doc.get('_id')}: missing chapter_number or interval_index")
                skipped_count += 1
                continue

            # Construct interval_id
            interval_id = f"{chapter_number}_{interval_index}"

            # Extract themes and summary
            themes = interval_doc.get("interval_themes", [])
            summary = interval_doc.get("interval_summary", "")

            # Build embedding_text
            if isinstance(themes, list):
                themes_str = ", ".join(str(t) for t in themes if t)
            else:
                themes_str = str(themes) if themes else ""
            
            embedding_text = f"Themes: {themes_str}. Summary: {summary}".strip()

            # Create document for upsert
            doc: Dict[str, Any] = {
                "interval_id": interval_id,
                "corpus_name": corpus_name,
                "chapter_number": chapter_number,
                "interval_index": interval_index,
                "embedding_text": embedding_text,
            }
            
            # Optionally copy _id from source if present
            if "_id" in interval_doc:
                doc["source_interval_id"] = interval_doc["_id"]

            # Add UpdateOne operation
            if UpdateOne:
                pending_ops.append(
                    UpdateOne(
                        {"interval_id": interval_id},
                        {"$set": doc},
                        upsert=True
                    )
                )
                processed_count += 1

                # Flush batch when reaching batch_size
                if len(pending_ops) >= batch_size:
                    _flush_ops(target_collection, pending_ops)
                    pending_ops = []
            else:
                print("⚠ pymongo.UpdateOne not available, cannot perform bulk writes")
                error_count += 1

        # Flush remaining operations
        if pending_ops:
            _flush_ops(target_collection, pending_ops)

        print("\n=== Interval Theme Docs Creation Summary ===")
        print(f"Corpus: {corpus_name}")
        print(f"Database: {database_name or corpus_name}")
        print(f"Source collection: {source_collection}")
        print(f"Target collection: {target_collection_name}")
        print(f"Processed: {processed_count}")
        print(f"Skipped: {skipped_count}")
        if error_count > 0:
            print(f"Errors: {error_count}")

    except ConnectionFailure as e:
        print(f"Error connecting to MongoDB: {e}")
        raise
    finally:
        client.close()
        print("\n✓ Interval theme docs creation complete")


def _flush_ops(collection, ops: List[UpdateOne]):
    """Flush a batch of UpdateOne operations to MongoDB."""
    if not ops:
        return
    try:
        result = collection.bulk_write(ops, ordered=False)
        print(f"  ✓ Batch persisted: {len(ops)} operations (inserted: {result.inserted_count}, modified: {result.modified_count}, upserted: {result.upserted_count})")
    except Exception as exc:
        print(f"  ⚠ Bulk write error ({len(ops)} ops): {exc}")
