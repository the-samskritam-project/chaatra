"""
Cluster interval theme embeddings using HDBSCAN.

Reads embeddings from pancatantra_interval_theme_docs, clusters them using
HDBSCAN, and writes cluster documents to pancatantra_theme_clusters.
"""

import os
from typing import Dict, List, Any
from collections import defaultdict

try:
    import numpy as np
except ImportError:
    print("Error: numpy not installed. Install with: pip install numpy")
    raise

try:
    from pymongo.errors import ConnectionFailure
    from bson import ObjectId
except ImportError:
    ConnectionFailure = Exception  # type: ignore
    ObjectId = None  # type: ignore

from processor.utils.mongodb_utils import connect_mongodb


def cluster_interval_themes(
    mongodb_uri: str,
    database_name: str = "pancatantra",
    source_collection: str = "pancatantra_interval_theme_docs",
    target_collection: str = "pancatantra_theme_clusters",
    min_cluster_size: int = 5,
    min_samples: int = 5
):
    """
    Cluster interval theme embeddings using HDBSCAN.
    
    Args:
        mongodb_uri: MongoDB connection URI
        database_name: Database name (default: pancatantra)
        source_collection: Source collection name (default: pancatantra_interval_theme_docs)
        target_collection: Target collection name (default: pancatantra_theme_clusters)
        min_cluster_size: Minimum cluster size for HDBSCAN (default: 5)
        min_samples: Minimum samples for HDBSCAN (default: 5)
    """
    # Connect to MongoDB
    print(f"Connecting to MongoDB database: {database_name}")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
        source_coll = db[source_collection]
        target_coll = db[target_collection]
    except ConnectionFailure as e:
        print(f"Error connecting to MongoDB: {e}")
        raise
    
    # Load all documents with embeddings
    print(f"\nLoading documents from {source_collection}...")
    cursor = source_coll.find({"embedding": {"$exists": True, "$ne": None}})
    documents = list(cursor)
    
    if not documents:
        print("No documents with embeddings found.")
        client.close()
        return
    
    print(f"Loaded {len(documents)} documents with embeddings")
    
    # Extract embeddings and interval_ids (preserve mapping)
    embeddings_list = []
    doc_ids = []
    
    for doc in documents:
        embedding = doc.get("embedding")
        if embedding and isinstance(embedding, list) and len(embedding) > 0:
            embeddings_list.append(embedding)
            # Use _id (ObjectId) from the document
            doc_ids.append(doc["_id"])
        else:
            print(f"⚠ Skipping document {doc.get('_id')}: invalid embedding")
    
    if not embeddings_list:
        print("No valid embeddings found.")
        client.close()
        return
    
    print(f"Extracted {len(embeddings_list)} valid embeddings")
    
    # Convert embeddings to numpy array
    print("\nConverting embeddings to numpy array...")
    embeddings_array = np.array(embeddings_list, dtype=np.float32)
    print(f"Embedding shape: {embeddings_array.shape}")
    
    # Run HDBSCAN clustering
    # Imported lazily so the rest of the command registry isn't blocked
    # when hdbscan (a heavy optional dep) isn't installed.
    try:
        import hdbscan
    except ImportError:
        print("Error: hdbscan not installed. Install with: pip install hdbscan")
        raise
    print(f"\nRunning HDBSCAN clustering (min_cluster_size={min_cluster_size}, min_samples={min_samples})...")
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric='euclidean'
    )
    cluster_labels = clusterer.fit_predict(embeddings_array)
    
    # Count clusters and noise
    unique_labels = set(cluster_labels)
    num_clusters = len([l for l in unique_labels if l >= 0])
    num_noise = list(cluster_labels).count(-1)
    
    print(f"✓ Clustering complete:")
    print(f"  Clusters found: {num_clusters}")
    print(f"  Noise points: {num_noise}")
    print(f"  Total points: {len(cluster_labels)}")
    
    # Group interval_ids by cluster label
    clusters_dict: Dict[int, List[Any]] = defaultdict(list)
    noise_points = []
    
    for label, doc_id in zip(cluster_labels, doc_ids):
        if label >= 0:
            clusters_dict[label].append(doc_id)
        else:  # label == -1 (noise points)
            noise_points.append(doc_id)
    
    # Create cluster documents for regular clusters
    cluster_docs = []
    for cluster_id, interval_ids in clusters_dict.items():
        cluster_doc = {
            "cluster_id": int(cluster_id),  # Convert numpy int to Python int
            "interval_ids": interval_ids,
            "size": int(len(interval_ids))  # Convert to Python int
        }
        cluster_docs.append(cluster_doc)
    
    # Create single-point clusters for noise points
    # Start cluster IDs from max_cluster_id + 1, or 0 if no clusters
    max_cluster_id = max(clusters_dict.keys()) if clusters_dict else -1
    next_cluster_id = max_cluster_id + 1
    
    for noise_doc_id in noise_points:
        cluster_doc = {
            "cluster_id": int(next_cluster_id),
            "interval_ids": [noise_doc_id],  # Single interval
            "size": 1
        }
        cluster_docs.append(cluster_doc)
        next_cluster_id += 1
    
    # Sort by cluster_id for consistency
    cluster_docs.sort(key=lambda x: x["cluster_id"])
    
    # Clear existing clusters (idempotent)
    print(f"\nClearing existing collection: {target_collection}")
    try:
        target_coll.drop()
        print("✓ Collection cleared")
    except Exception as e:
        print(f"⚠ Error clearing collection (may not exist): {e}")
        # Try delete_many as fallback
        try:
            target_coll.delete_many({})
            print("✓ Collection cleared (using delete_many)")
        except Exception as e2:
            print(f"⚠ Error with delete_many: {e2}")
    
    # Write cluster documents
    print(f"\nWriting {len(cluster_docs)} cluster documents to {target_collection}...")
    try:
        result = target_coll.insert_many(cluster_docs)
        print(f"✓ Inserted {len(result.inserted_ids)} cluster documents")
    except Exception as e:
        print(f"✗ Error inserting cluster documents: {e}")
        client.close()
        raise
    
    # Summary
    total_intervals_clustered = sum(doc["size"] for doc in cluster_docs)
    multi_point_clusters = len([d for d in cluster_docs if d["size"] > 1])
    single_point_clusters = len([d for d in cluster_docs if d["size"] == 1])
    
    print("\n" + "=" * 60)
    print("Clustering Summary:")
    print(f"  Total documents processed: {len(documents)}")
    print(f"  Valid embeddings: {len(embeddings_list)}")
    print(f"  Multi-point clusters: {multi_point_clusters}")
    print(f"  Single-point clusters (noise): {single_point_clusters}")
    print(f"  Total cluster documents: {len(cluster_docs)}")
    print(f"  Total intervals in clusters: {total_intervals_clustered}")
    print("=" * 60)
    
    client.close()
    print("\n✓ Clustering completed!")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Cluster interval theme embeddings using HDBSCAN"
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
        "--source-collection",
        help="Source collection name (default: pancatantra_interval_theme_docs)",
        default="pancatantra_interval_theme_docs"
    )
    parser.add_argument(
        "--target-collection",
        help="Target collection name (default: pancatantra_theme_clusters)",
        default="pancatantra_theme_clusters"
    )
    parser.add_argument(
        "--min-cluster-size",
        type=int,
        default=5,
        help="Minimum cluster size for HDBSCAN (default: 5)"
    )
    parser.add_argument(
        "--min-samples",
        type=int,
        default=5,
        help="Minimum samples for HDBSCAN (default: 5)"
    )
    
    args = parser.parse_args()
    
    if not args.mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        exit(1)
    
    cluster_interval_themes(
        mongodb_uri=args.mongodb_uri,
        database_name=args.database,
        source_collection=args.source_collection,
        target_collection=args.target_collection,
        min_cluster_size=args.min_cluster_size,
        min_samples=args.min_samples
    )
