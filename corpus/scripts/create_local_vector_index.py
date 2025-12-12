#!/usr/bin/env python3
"""
Create vector search index for local MongoDB 7.0+.

This script creates a vector search index on the corpus_vector_search collection.
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


def create_vector_index():
    """Create vector search index."""
    mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
    db_name = os.getenv('MONGODB_VECTOR_DATABASE') or os.getenv('MONGODB_DATABASE', 'hitopadesa')
    collection_name = os.getenv('MONGODB_VECTOR_COLLECTION', 'corpus_vector_search')
    index_name = os.getenv('MONGODB_VECTOR_INDEX_NAME', 'corpus_translation_vector_index')
    
    # Get embedding dimension from model
    model_name = os.getenv('LANGCHAIN_EMBEDDING_MODEL', 'text-embedding-3-small')
    dimension_map = {
        'text-embedding-3-small': 1536,
        'text-embedding-3-large': 3072,
        'text-embedding-ada-002': 1536,
        'text-embedding-002': 1536,
    }
    dimension = dimension_map.get(model_name, 1536)
    
    print("="*60)
    print("Creating Vector Search Index")
    print("="*60)
    print(f"MongoDB URI: {mongodb_uri[:50]}...")
    print(f"Database: {db_name}")
    print(f"Collection: {collection_name}")
    print(f"Index name: {index_name}")
    print(f"Embedding dimension: {dimension}")
    print(f"Model: {model_name}")
    print()
    
    try:
        client = MongoClient(mongodb_uri)
        db = client[db_name]
        collection = db[collection_name]
        
        # Check if collection exists
        collections = db.list_collection_names()
        if collection_name not in collections:
            print(f"❌ ERROR: Collection '{collection_name}' does not exist!")
            print(f"   Available collections: {', '.join(collections)}")
            print("\nPlease generate embeddings first:")
            print("  python command_processor.py generate_embeddings hitopadesa")
            return False
        
        # Check document count
        count = collection.count_documents({})
        if count == 0:
            print(f"⚠ WARNING: Collection '{collection_name}' is empty!")
            print("Please generate embeddings first.")
            return False
        
        print(f"✓ Collection exists with {count} documents")
        
        # Check if embeddings exist
        sample = collection.find_one({"embedding": {"$exists": True}})
        if not sample:
            print("⚠ WARNING: No documents with embeddings found!")
            return False
        
        emb_dim = len(sample.get("embedding", []))
        if emb_dim != dimension:
            print(f"⚠ WARNING: Embedding dimension mismatch!")
            print(f"   Expected: {dimension}, Found: {emb_dim}")
            print(f"   Using found dimension: {emb_dim}")
            dimension = emb_dim
        
        print(f"✓ Found embeddings with dimension: {dimension}")
        print()
        
        # Check for existing indexes
        print("Checking for existing search indexes...")
        try:
            result = db.command("listSearchIndexes", collection_name)
            existing_indexes = result.get("indexes", [])
            
            for idx in existing_indexes:
                if idx.get("name") == index_name:
                    status = idx.get("status", "unknown")
                    print(f"✓ Index '{index_name}' already exists (status: {status})")
                    if status == "READY":
                        print("  Index is ready to use!")
                        return True
                    else:
                        print(f"  Index is still building. Status: {status}")
                        print("  Please wait for it to complete.")
                        return True
        except OperationFailure as e:
            if "not found" not in str(e).lower():
                print(f"  Note: {e}")
        
        # Create the index
        print(f"\nCreating vector search index '{index_name}'...")
        print("This may take a few minutes for large collections...")
        print()
        
        # For local MongoDB 7.0+, try different methods
        try:
            # Method 1: Try using SearchIndexModel (for newer pymongo versions)
            try:
                from pymongo.operations import SearchIndexModel
                
                vector_index = SearchIndexModel(
                    definition={
                        "fields": [
                            {
                                "type": "vector",
                                "path": "embedding",
                                "numDimensions": dimension,
                                "similarity": "cosine"
                            }
                        ]
                    },
                    name=index_name,
                    type="vectorSearch"
                )
                
                result = collection.create_search_index(vector_index)
                print(f"✓ Index creation initiated!")
                print(f"  Index ID: {result}")
                print("\nThe index is now building. This may take a few minutes.")
                print("You can check status with:")
                print(f"  python scripts/check_vector_index.py")
                return True
                
            except ImportError:
                # SearchIndexModel not available, try direct method
                raise AttributeError("SearchIndexModel not available")
                
        except (AttributeError, TypeError) as e:
            # Method 2: Try using createSearchIndexes command (for local MongoDB)
            print("Trying alternative method...")
            try:
                # For local MongoDB 7.0+, use the createSearchIndexes command
                result = db.command({
                    "createSearchIndexes": collection_name,
                    "indexes": [{
                        "name": index_name,
                        "definition": {
                            "mappings": {
                                "dynamic": False,
                                "fields": {
                                    "embedding": {
                                        "type": "knnVector",
                                        "dimensions": dimension,
                                        "similarity": "cosine"
                                    }
                                }
                            }
                        }
                    }]
                })
                print(f"✓ Index creation initiated!")
                print(f"  Result: {result}")
                print("\nThe index is now building. This may take a few minutes.")
                return True
            except OperationFailure as cmd_error:
                # If command fails, provide mongosh instructions
                error_msg = str(cmd_error)
                if "already exists" in error_msg.lower():
                    print(f"✓ Index '{index_name}' already exists!")
                    return True
                else:
                    raise cmd_error
            
        except OperationFailure as e:
            error_msg = str(e)
            if "already exists" in error_msg.lower():
                print(f"✓ Index '{index_name}' already exists!")
                return True
            else:
                print(f"❌ ERROR creating index: {e}")
                print("\nPossible reasons:")
                print("  1. MongoDB version < 7.0.11 (vector search not supported)")
                print("  2. Vector search not enabled in your MongoDB setup")
                print("  3. Insufficient permissions")
                print("\n" + "="*60)
                print("MANUAL SETUP REQUIRED")
                print("="*60)
                print("Local MongoDB 7.0+ requires creating the index via mongosh.")
                print("\nOption 1: Run the mongosh script:")
                print(f"  mongosh {mongodb_uri} < scripts/create_vector_index.mongosh.js")
                print("\nOption 2: Run commands manually in mongosh:")
                print(f"  mongosh {mongodb_uri}")
                print(f"  use {db_name}")
                print(f"  db.{collection_name}.createSearchIndex({{")
                print(f'    "name": "{index_name}",')
                print('    "definition": {')
                print('      "mappings": {')
                print('        "dynamic": false,')
                print('        "fields": {')
                print('          "embedding": {')
                print(f'            "type": "knnVector",')
                print(f'            "dimensions": {dimension},')
                print('            "similarity": "cosine"')
                print('          }')
                print('        }')
                print('      }')
                print('    }')
                print('  })')
                print("\nOption 3: If using Docker:")
                print(f"  docker exec -i <mongodb-container> mongosh {mongodb_uri} < scripts/create_vector_index.mongosh.js")
                return False
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        try:
            client.close()
        except:
            pass


if __name__ == '__main__':
    success = create_vector_index()
    sys.exit(0 if success else 1)
