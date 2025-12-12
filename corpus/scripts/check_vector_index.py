#!/usr/bin/env python3
"""
Check if vector search index exists and show its status.
"""

import os
import sys
from pymongo import MongoClient
from pymongo.errors import OperationFailure

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def check_vector_index():
    """Check for vector search index."""
    mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
    db_name = os.getenv('MONGODB_VECTOR_DATABASE') or os.getenv('MONGODB_DATABASE', 'hitopadesa')
    collection_name = os.getenv('MONGODB_VECTOR_COLLECTION', 'corpus_vector_search')
    
    print(f"Connecting to MongoDB...")
    print(f"  URI: {mongodb_uri[:50]}...")
    print(f"  Database: {db_name}")
    print(f"  Collection: {collection_name}")
    print()
    
    try:
        client = MongoClient(mongodb_uri)
        db = client[db_name]
        
        # Check collection exists
        collections = db.list_collection_names()
        if collection_name not in collections:
            print(f"❌ Collection '{collection_name}' does not exist!")
            print(f"   Available collections: {', '.join(collections)}")
            return
        
        # Count documents
        collection = db[collection_name]
        count = collection.count_documents({})
        print(f"✓ Collection exists with {count} documents")
        
        # Check for embeddings
        sample = collection.find_one({"embedding": {"$exists": True}})
        if sample:
            dim = len(sample.get("embedding", []))
            print(f"✓ Found embeddings with dimension: {dim}")
        else:
            print("⚠ No documents with embeddings found")
        
        print()
        print("Checking for vector search indexes...")
        
        # Try to list search indexes using admin command
        try:
            # Use admin command to check for search indexes
            result = db.command("listSearchIndexes", collection_name)
            indexes = result.get("indexes", [])
            
            if indexes:
                print(f"\n✓ Found {len(indexes)} search index(es):")
                for idx in indexes:
                    name = idx.get("name", "unnamed")
                    idx_type = idx.get("type", "unknown")
                    status = idx.get("status", "unknown")
                    print(f"\n  Index: {name}")
                    print(f"    Type: {idx_type}")
                    print(f"    Status: {status}")
                    
                    # Show definition if available
                    if "definition" in idx:
                        defn = idx["definition"]
                        if "mappings" in defn and "fields" in defn["mappings"]:
                            fields = defn["mappings"]["fields"]
                            if "embedding" in fields:
                                emb_field = fields["embedding"]
                                print(f"    Vector field: embedding")
                                print(f"    Dimensions: {emb_field.get('dimensions', 'unknown')}")
                                print(f"    Similarity: {emb_field.get('similarity', 'unknown')}")
            else:
                print("\n❌ No search indexes found!")
                print("\nYou need to create a vector search index.")
                print("Run: python scripts/create_local_vector_index.py")
        except OperationFailure as e:
            error_msg = str(e)
            if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
                print("\n❌ No search indexes found!")
                print("\nYou need to create a vector search index.")
                print("Run: python scripts/create_local_vector_index.py")
            else:
                print(f"\n⚠ Error checking search indexes: {e}")
                print("\nThis might mean:")
                print("  - Vector search is not available in your MongoDB version")
                print("  - For local MongoDB, ensure you're using version 7.0.11+")
                print("  - Try using MongoDB shell (mongosh) to create the index manually")
        except Exception as e:
            print(f"\n⚠ Could not check search indexes: {e}")
            print("\nTrying alternative method...")
            # Fallback: just tell user to check manually
            print("Please check manually using mongosh:")
            print(f"  mongosh {mongodb_uri}")
            print(f"  use {db_name}")
            print(f"  db.{collection_name}.listSearchIndexes()")
        
        # Also check regular indexes (for reference)
        print("\n" + "="*60)
        print("Regular indexes (for reference):")
        regular_indexes = collection.list_indexes()
        has_indexes = False
        for idx in regular_indexes:
            has_indexes = True
            print(f"  - {idx.get('name', 'unnamed')}: {idx.get('keys', {})}")
        if not has_indexes:
            print("  (No regular indexes)")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    check_vector_index()
