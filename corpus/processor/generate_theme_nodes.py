"""
Generate higher-order theme nodes from clusters.

Reads clusters from pancatantra_theme_clusters, fetches interval themes/summaries,
and uses OpenAI to generate abstracted higher-order themes with sub-themes.
"""

import json
import re
import time
from typing import List, Optional, Dict, Any

try:
    from pymongo.errors import ConnectionFailure
except ImportError:
    ConnectionFailure = Exception  # type: ignore

from langchain_openai import ChatOpenAI
from processor.utils.mongodb_utils import connect_mongodb

PROMPT_TEMPLATE = """You are analyzing a cluster of story intervals from the Pancatantra, each with themes and summaries.

Your task is to abstract a higher-order conceptual theme that unifies these intervals, moving beyond specific narrative details to identify the underlying philosophical, moral, or thematic principle.

Provide ONLY JSON (no markdown, no code fences, no prose), with keys:
- name: A concise higher-order theme name (2-4 words, title case, e.g., "Wisdom Through Experience", "Consequences of Deception")
- definition: A 2-3 sentence definition explaining the abstract concept, avoiding verse-specific details
- subthemes: An array of 3-6 sub-theme names (each 1-3 words, lowercase, dash-separated if multiword) that represent specific aspects or manifestations of this higher-order theme

Rules:
- Output must be plain JSON, no ``` fences or extra text.
- Focus on conceptual abstraction, not narrative specifics.
- The higher-order theme should be broad enough to encompass all intervals in the cluster.
- Sub-themes should represent distinct aspects or variations of the main theme.
- Avoid verse-level specificity or character names.
- Base everything on the provided themes and summaries.

Cluster intervals:
{cluster_data}
"""


def slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    # Convert to lowercase
    text = text.lower()
    # Replace spaces and special chars with dashes
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    # Remove leading/trailing dashes
    return text.strip('-')


def generate_theme_nodes(
    mongodb_uri: str,
    database_name: str = "pancatantra",
    clusters_collection: str = "pancatantra_theme_clusters",
    intervals_collection: str = "pancatantra_interval_theme_docs",
    target_collection: str = "pancatantra_theme_nodes",
    api_key: Optional[str] = None,
    model: str = "gpt-4o",
    delay: float = 0.0,
    force: bool = False
):
    """
    Generate higher-order theme nodes from clusters.
    
    Args:
        mongodb_uri: MongoDB connection URI
        database_name: Database name (default: pancatantra)
        clusters_collection: Clusters collection name
        intervals_collection: Interval theme docs collection name
        target_collection: Target collection for theme nodes
        api_key: OpenAI API key (optional, uses env vars if not provided)
        model: OpenAI model to use (default: gpt-4o)
        delay: Delay between API calls in seconds (default: 0.0)
        force: Overwrite existing theme nodes (default: False)
    """
    # Connect to MongoDB
    print(f"Connecting to MongoDB database: {database_name}")
    try:
        db, client = connect_mongodb(mongodb_uri, database_name)
        clusters_coll = db[clusters_collection]
        intervals_coll = db[intervals_collection]
        target_coll = db[target_collection]
    except ConnectionFailure as e:
        print(f"Error connecting to MongoDB: {e}")
        raise
    
    # Initialize LLM
    print(f"Initializing OpenAI model: {model}")
    try:
        llm = ChatOpenAI(model=model, temperature=0, openai_api_key=api_key)
    except Exception as e:
        print(f"Error initializing LLM: {e}")
        client.close()
        raise
    
    # Load all clusters
    print(f"\nLoading clusters from {clusters_collection}...")
    clusters = list(clusters_coll.find({}).sort("cluster_id", 1))
    
    if not clusters:
        print("No clusters found.")
        client.close()
        return
    
    print(f"Found {len(clusters)} clusters")
    
    # Process each cluster
    processed = 0
    skipped = 0
    errors = 0
    
    for cluster in clusters:
        cluster_id = cluster.get("cluster_id")
        interval_ids = cluster.get("interval_ids", [])
        
        if not interval_ids:
            print(f"⚠ Cluster {cluster_id} has no interval_ids, skipping")
            skipped += 1
            continue
        
        # Check if already processed
        if not force:
            existing = target_coll.find_one({"cluster_id": cluster_id})
            if existing:
                print(f"⊘ Skip cluster {cluster_id} (already processed)")
                skipped += 1
                continue
        
        # Fetch interval documents
        interval_docs = list(intervals_coll.find({"_id": {"$in": interval_ids}}))
        
        if not interval_docs:
            print(f"⚠ Cluster {cluster_id}: No interval documents found for {len(interval_ids)} interval_ids")
            errors += 1
            continue
        
        # Extract themes and summaries
        cluster_data = []
        for interval_doc in interval_docs:
            themes = interval_doc.get("interval_themes", [])
            summary = interval_doc.get("interval_summary", "")
            
            if isinstance(themes, list):
                themes_str = ", ".join(str(t) for t in themes if t)
            else:
                themes_str = str(themes) if themes else ""
            
            cluster_data.append({
                "themes": themes_str,
                "summary": summary
            })
        
        # Build prompt
        cluster_text = "\n\n".join([
            f"Themes: {item['themes']}\nSummary: {item['summary']}"
            for item in cluster_data
        ])
        
        prompt = PROMPT_TEMPLATE.format(cluster_data=cluster_text)
        
        # Call OpenAI
        try:
            print(f"\nProcessing cluster {cluster_id} ({len(interval_ids)} intervals)...")
            resp = llm.invoke(prompt)
            content = getattr(resp, "content", "") or ""
            
            # Parse JSON response
            theme_data = _parse_response(content)
            
            if not theme_data or not theme_data.get("name"):
                print(f"⚠ Cluster {cluster_id}: Invalid response, skipping")
                errors += 1
                continue
            
            # Create theme node document
            theme_name = theme_data["name"]
            theme_id = slugify(theme_name)
            
            theme_node = {
                "theme_id": theme_id,
                "level": "higher",
                "cluster_id": int(cluster_id),
                "name": theme_name,
                "definition": theme_data.get("definition", ""),
                "subthemes": theme_data.get("subthemes", []),
                "interval_ids": interval_ids,
                "model": model
            }
            
            # Upsert to target collection
            target_coll.update_one(
                {"cluster_id": cluster_id},
                {"$set": theme_node},
                upsert=True
            )
            
            print(f"✓ Cluster {cluster_id} -> Theme: {theme_name} ({len(theme_data.get('subthemes', []))} sub-themes)")
            processed += 1
            
            if delay > 0:
                time.sleep(delay)
                
        except Exception as e:
            print(f"✗ Error processing cluster {cluster_id}: {e}")
            errors += 1
            continue
    
    # Summary
    print("\n" + "=" * 60)
    print("Theme Node Generation Summary:")
    print(f"  Total clusters: {len(clusters)}")
    print(f"  Processed: {processed}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {errors}")
    print("=" * 60)
    
    client.close()
    print("\n✓ Theme node generation completed!")


def _parse_response(content: str) -> Optional[Dict[str, Any]]:
    """Parse JSON response from OpenAI, handling code fences."""
    raw = content.strip()
    
    # Strip code fences if present
    raw = re.sub(r"^```\w*\s*", "", raw)
    raw = re.sub(r"```\s*$", "", raw)
    
    # Extract JSON between first { and last }
    if "{" in raw and "}" in raw:
        raw = raw[raw.find("{"): raw.rfind("}") + 1]
    
    try:
        data = json.loads(raw)
        return data
    except json.JSONDecodeError as e:
        print(f"⚠ JSON parse error: {e}")
        print(f"  Response content: {raw[:200]}...")
        return None
