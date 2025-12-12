#!/usr/bin/env python3
"""
Helper script to create vector search index definition and provide instructions.

This script generates the index definition JSON and provides instructions
for creating the index in MongoDB Atlas or local MongoDB.
"""

import os
import sys
import json
import argparse

try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure
except ImportError:
    print("Error: pymongo not installed. Install with: pip install pymongo")
    sys.exit(1)


def get_embedding_dimension(model_name: str = None) -> int:
    """
    Get embedding dimension for a given model.
    
    Args:
        model_name: Model name (default: from env var or OpenAI default)
    
    Returns:
        Embedding dimension
    """
    if model_name is None:
        model_name = os.getenv('LANGCHAIN_EMBEDDING_MODEL', 'text-embedding-3-small')
    
    # Common embedding model dimensions
    dimensions_map = {
        'text-embedding-3-small': 1536,
        'text-embedding-3-large': 3072,
        'text-embedding-ada-002': 1536,
        'text-embedding-002': 1536,
    }
    
    # Check for exact match
    if model_name in dimensions_map:
        return dimensions_map[model_name]
    
    # Check for partial match
    for key, dim in dimensions_map.items():
        if key in model_name:
            return dim
    
    # Default to 1536 (most common)
    print(f"Warning: Unknown model '{model_name}', defaulting to 1536 dimensions")
    return 1536


def create_index_definition(
    index_name: str = "corpus_translation_vector_index",
    dimension: int = None,
    model_name: str = None
) -> dict:
    """
    Create vector search index definition.
    
    Args:
        index_name: Index name
        dimension: Embedding dimension (auto-detected if not provided)
        model_name: Model name for dimension detection
    
    Returns:
        Index definition dictionary
    """
    if dimension is None:
        dimension = get_embedding_dimension(model_name)
    
    # Atlas vector search index definition
    index_definition = {
        "name": index_name,
        "type": "vectorSearch",
        "definition": {
            "fields": [
                {
                    "type": "vector",
                    "path": "embedding",
                    "numDimensions": dimension,
                    "similarity": "cosine"
                }
            ]
        }
    }
    
    return index_definition


def print_instructions(index_definition: dict, database_name: str, collection_name: str):
    """
    Print instructions for creating the index.
    
    Args:
        index_definition: Index definition dictionary
        database_name: Database name
        collection_name: Collection name
    """
    print("\n" + "="*80)
    print("MongoDB Vector Search Index Setup")
    print("="*80)
    print(f"\nIndex Name: {index_definition['name']}")
    print(f"Database: {database_name}")
    print(f"Collection: {collection_name}")
    print(f"Dimensions: {index_definition['definition']['fields'][0]['numDimensions']}")
    print(f"Similarity: {index_definition['definition']['fields'][0]['similarity']}")
    
    print("\n" + "-"*80)
    print("Method 1: MongoDB Atlas UI")
    print("-"*80)
    print("1. Log in to https://cloud.mongodb.com/")
    print("2. Navigate to your cluster")
    print("3. Click on 'Search' in the left sidebar")
    print("4. Click 'Create Search Index'")
    print("5. Select 'JSON Editor'")
    print("6. Paste the JSON definition below")
    print("7. Click 'Next' and then 'Create Search Index'")
    
    print("\n" + "-"*80)
    print("Method 2: Atlas CLI")
    print("-"*80)
    print("1. Install Atlas CLI: https://www.mongodb.com/docs/atlas/cli/stable/install-atlas-cli/")
    print("2. Authenticate: atlas auth login")
    print("3. Save the JSON definition below to a file (e.g., index.json)")
    print("4. Run: atlas clusters search indexes create \\")
    print(f"     --clusterName <your-cluster-name> \\")
    print(f"     --db {database_name} \\")
    print(f"     --collection {collection_name} \\")
    print("     --file index.json")
    
    print("\n" + "-"*80)
    print("Method 3: MongoDB Shell (mongosh) - Local MongoDB 7.0.11+")
    print("-"*80)
    print("Note: This method works for local MongoDB with vector search support.")
    print("Connect to your MongoDB and run:")
    print(f"  use {database_name};")
    print(f"  db.{collection_name}.createSearchIndex({{")
    print('    "name": "' + index_definition['name'] + '",')
    print('    "definition": {')
    print('      "mappings": {')
    print('        "dynamic": false,')
    print('        "fields": {')
    print('          "embedding": {')
    print('            "type": "knnVector",')
    print(f'            "dimensions": {index_definition["definition"]["fields"][0]["numDimensions"]},')
    print('            "similarity": "cosine"')
    print('          }')
    print('        }')
    print('      }')
    print('    }')
    print('  });')
    
    print("\n" + "-"*80)
    print("Index Definition JSON")
    print("-"*80)
    print(json.dumps(index_definition, indent=2))
    print("="*80 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Generate vector search index definition and instructions'
    )
    parser.add_argument(
        '--database',
        default=os.getenv('MONGODB_VECTOR_DATABASE') or os.getenv('MONGODB_DATABASE', 'hitopadesa'),
        help='Database name'
    )
    parser.add_argument(
        '--collection',
        default=os.getenv('MONGODB_VECTOR_COLLECTION', 'corpus_vector_search'),
        help='Collection name'
    )
    parser.add_argument(
        '--index-name',
        default='corpus_translation_vector_index',
        help='Index name'
    )
    parser.add_argument(
        '--dimension',
        type=int,
        help='Embedding dimension (auto-detected from model if not provided)'
    )
    parser.add_argument(
        '--model',
        default=os.getenv('LANGCHAIN_EMBEDDING_MODEL'),
        help='Embedding model name (for dimension detection)'
    )
    
    args = parser.parse_args()
    
    index_definition = create_index_definition(
        index_name=args.index_name,
        dimension=args.dimension,
        model_name=args.model
    )
    
    print_instructions(index_definition, args.database, args.collection)


if __name__ == '__main__':
    main()
