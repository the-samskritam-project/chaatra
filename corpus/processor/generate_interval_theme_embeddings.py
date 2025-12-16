"""
Generate embeddings for interval theme documents.

Reads from pancatantra_interval_theme_docs collection, generates embeddings
for embedding_text field using OpenAI text-embedding-3-large, and updates
documents in place.
"""

import os
from typing import Optional, List, Dict, Any

try:
    from pymongo.errors import ConnectionFailure
except ImportError:
    ConnectionFailure = Exception  # type: ignore

from processor.utils.mongodb_utils import connect_mongodb
from processor.embeddings.langchain_embeddings import get_embedding_model


def generate_interval_theme_embeddings(
    mongodb_uri: str,
    database_name: str = "pancatantra",
    collection_name: str = "pancatantra_interval_theme_docs",
    batch_size: int = 100,
    api_key: Optional[str] = None
):
    """
    Generate embeddings for embedding_text field in interval theme documents.
    
    Args:
        mongodb_uri: MongoDB connection URI
        database_name: Database name (default: pancatantra)
        collection_name: Collection name (default: pancatantra_interval_theme_docs)
        batch_size: Batch size for processing (default: 100)
        api_key: OpenAI API key (optional, uses env vars if not provided)
    """
    # Connect to MongoDB
    print(f"Connecting to MongoDB database: {database_name}")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
        collection = db[collection_name]
    except ConnectionFailure as e:
        print(f"Error connecting to MongoDB: {e}")
        raise
    
    # Initialize embedding model
    print("Initializing OpenAI embedding model: text-embedding-3-large")
    try:
        embedding_model = get_embedding_model(
            provider="openai",
            model_name="text-embedding-3-large",
            api_key=api_key
        )
        print("✓ Embedding model initialized")
    except Exception as e:
        print(f"Error initializing embedding model: {e}")
        client.close()
        raise
    
    # Query documents missing embeddings
    query = {"embedding": {"$exists": False}}
    cursor = collection.find(query)
    
    # Count total documents to process
    total_count = collection.count_documents(query)
    print(f"\nFound {total_count} documents missing embeddings")
    
    if total_count == 0:
        print("No documents to process. All documents already have embeddings.")
        client.close()
        return
    
    # Process in batches
    processed_count = 0
    error_count = 0
    batch_docs: List[Dict[str, Any]] = []
    batch_texts: List[str] = []
    batch_ids: List[Any] = []
    
    for doc in cursor:
        embedding_text = doc.get("embedding_text")
        if not embedding_text or not isinstance(embedding_text, str):
            print(f"⚠ Skipping document {doc.get('_id')}: missing or invalid embedding_text")
            error_count += 1
            continue
        
        batch_docs.append(doc)
        batch_texts.append(embedding_text)
        batch_ids.append(doc["_id"])
        
        # Process batch when reaching batch_size
        if len(batch_docs) >= batch_size:
            processed, errors = _process_batch(
                collection, embedding_model, batch_docs, batch_texts, batch_ids
            )
            processed_count += processed
            error_count += errors
            
            # Reset batch
            batch_docs = []
            batch_texts = []
            batch_ids = []
            
            print(f"Progress: {processed_count}/{total_count} documents processed")
    
    # Process remaining documents in final batch
    if batch_docs:
        processed, errors = _process_batch(
            collection, embedding_model, batch_docs, batch_texts, batch_ids
        )
        processed_count += processed
        error_count += errors
    
    # Summary
    print("\n" + "=" * 60)
    print("Embedding Generation Summary:")
    print(f"  Total documents found: {total_count}")
    print(f"  Successfully processed: {processed_count}")
    print(f"  Errors: {error_count}")
    print("=" * 60)
    
    client.close()
    print("\n✓ Embedding generation completed!")


def _process_batch(
    collection,
    embedding_model,
    batch_docs: List[Dict[str, Any]],
    batch_texts: List[str],
    batch_ids: List[Any]
) -> tuple[int, int]:
    """
    Process a batch of documents: generate embeddings and update in MongoDB.
    
    Returns:
        Tuple of (processed_count, error_count)
    """
    if not batch_docs:
        return 0, 0
    
    batch_num = len(batch_docs)
    print(f"\nProcessing batch of {batch_num} documents...")
    
    # Generate embeddings
    try:
        print(f"  Generating embeddings...")
        embeddings = embedding_model.embed_documents(batch_texts)
        print(f"  ✓ Generated {len(embeddings)} embeddings")
    except Exception as e:
        print(f"  ✗ Error generating embeddings: {e}")
        return 0, batch_num
    
    # Update documents in place
    processed = 0
    errors = 0
    
    for i, doc_id in enumerate(batch_ids):
        try:
            embedding = embeddings[i]
            # Ensure embedding is a list of floats
            if not isinstance(embedding, list):
                print(f"  ⚠ Unexpected embedding type for document {doc_id}")
                errors += 1
                continue
            
            # Update document in place
            result = collection.update_one(
                {"_id": doc_id},
                {"$set": {"embedding": embedding}}
            )
            
            if result.modified_count > 0:
                processed += 1
            else:
                print(f"  ⚠ Document {doc_id} was not updated (may have been modified concurrently)")
                errors += 1
                
        except Exception as e:
            print(f"  ✗ Error updating document {doc_id}: {e}")
            errors += 1
    
    print(f"  ✓ Updated {processed} documents in batch")
    if errors > 0:
        print(f"  ⚠ {errors} errors in batch")
    
    return processed, errors


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Generate embeddings for interval theme documents"
    )
    parser.add_argument(
        "--mongodb-uri",
        help="MongoDB connection URI (or set MONGODB_URI env var)",
        default=os.getenv("MONGODB_URI")
    )
    parser.add_argument(
        "--database",
        help="Database name (default: pancatantra)",
        default="pancatantra"
    )
    parser.add_argument(
        "--collection",
        help="Collection name (default: pancatantra_interval_theme_docs)",
        default="pancatantra_interval_theme_docs"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size for processing (default: 100)"
    )
    parser.add_argument(
        "--api-key",
        help="OpenAI API key (or set OPENAI_API_KEY or LANGCHAIN_API_KEY env var)",
        default=None
    )
    
    args = parser.parse_args()
    
    if not args.mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        exit(1)
    
    generate_interval_theme_embeddings(
        mongodb_uri=args.mongodb_uri,
        database_name=args.database,
        collection_name=args.collection,
        batch_size=args.batch_size,
        api_key=args.api_key
    )
