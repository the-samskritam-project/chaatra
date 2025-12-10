#!/usr/bin/env python3
"""
Verify MongoDB migration by comparing collection counts between local and Atlas.

Checks that all collections exist and have the same document counts.
"""

import os
import sys
import subprocess
import json
from pathlib import Path
from typing import Dict, Optional

# Try to load python-dotenv
try:
    from dotenv import load_dotenv
    HAS_DOTENV = True
except ImportError:
    HAS_DOTENV = False

# Colors for output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


def print_error(message: str):
    print(f"{Colors.RED}✗{Colors.NC} {message}")


def print_success(message: str):
    print(f"{Colors.GREEN}✓{Colors.NC} {message}")


def print_info(message: str):
    print(f"{Colors.BLUE}ℹ{Colors.NC} {message}")


def get_collection_count(uri: str, db_name: str, collection_name: str) -> Optional[int]:
    """Get document count for a collection."""
    try:
        # Use mongosh or mongo
        cmd = ["mongosh", uri, "--quiet", "--eval", 
               f"db.getSiblingDB('{db_name}').{collection_name}.countDocuments()"]
        
        # Try mongosh first, fallback to mongo
        if subprocess.run(["which", "mongosh"], capture_output=True).returncode != 0:
            cmd = ["mongo", uri, "--quiet", "--eval",
                   f"db.getSiblingDB('{db_name}').{collection_name}.countDocuments()"]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            count_str = result.stdout.strip()
            # Remove any non-numeric characters
            count_str = ''.join(c for c in count_str if c.isdigit() or c == '-')
            if count_str:
                return int(count_str)
    except Exception as e:
        print_error(f"Error getting count for {collection_name}: {e}")
    return None


def get_collections(uri: str, db_name: str) -> list:
    """Get list of collection names in a database."""
    try:
        cmd = ["mongosh", uri, "--quiet", "--eval",
               f"db.getSiblingDB('{db_name}').getCollectionNames()"]
        
        if subprocess.run(["which", "mongosh"], capture_output=True).returncode != 0:
            cmd = ["mongo", uri, "--quiet", "--eval",
                   f"db.getSiblingDB('{db_name}').getCollectionNames()"]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            # Parse JSON array from output
            output = result.stdout.strip()
            # Remove any leading/trailing non-JSON text
            start = output.find('[')
            end = output.rfind(']') + 1
            if start >= 0 and end > start:
                collections = json.loads(output[start:end])
                return collections
    except Exception as e:
        print_error(f"Error getting collections: {e}")
    return []


def verify_database(local_uri: str, atlas_uri: str, db_name: str) -> bool:
    """Verify a database migration."""
    print(f"\n{Colors.YELLOW}Verifying {db_name} database...{Colors.NC}")
    print("-" * 60)
    
    # Get collections from local
    print_info("Getting collections from local MongoDB...")
    local_collections = get_collections(local_uri, db_name)
    if not local_collections:
        print_error(f"Could not get collections from local {db_name} database")
        return False
    
    print_success(f"Found {len(local_collections)} collections in local database")
    
    # Get collections from Atlas
    print_info("Getting collections from Atlas...")
    atlas_collections = get_collections(atlas_uri, db_name)
    if not atlas_collections:
        print_error(f"Could not get collections from Atlas {db_name} database")
        return False
    
    print_success(f"Found {len(atlas_collections)} collections in Atlas database")
    
    # Check if all local collections exist in Atlas
    missing_collections = set(local_collections) - set(atlas_collections)
    if missing_collections:
        print_error(f"Missing collections in Atlas: {missing_collections}")
        return False
    
    # Compare counts for each collection
    all_match = True
    for collection in local_collections:
        local_count = get_collection_count(local_uri, db_name, collection)
        atlas_count = get_collection_count(atlas_uri, db_name, collection)
        
        if local_count is None or atlas_count is None:
            print_error(f"  {collection}: Could not get counts")
            all_match = False
        elif local_count == atlas_count:
            print_success(f"  {collection}: {local_count} documents (match)")
        else:
            print_error(f"  {collection}: Local={local_count}, Atlas={atlas_count} (mismatch)")
            all_match = False
    
    return all_match


def main():
    """Main verification function."""
    # Load .env file if it exists
    script_dir = Path(__file__).parent
    env_file = script_dir.parent / ".env"
    
    if env_file.exists():
        if HAS_DOTENV:
            load_dotenv(dotenv_path=env_file)
            print_success("Loaded environment variables from .env file")
        else:
            # Try to load manually (simple key=value parser)
            try:
                with open(env_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            key = key.strip()
                            value = value.strip().strip('"').strip("'")
                            os.environ[key] = value
            except Exception:
                pass
    
    print(f"{Colors.GREEN}MongoDB Migration Verification{Colors.NC}")
    print("=" * 60)
    
    # Get configuration
    local_uri = os.getenv("LOCAL_MONGODB_URI", "mongodb://localhost:27017")
    atlas_uri = os.getenv("ATLAS_URI")
    
    if not atlas_uri:
        print_error("ATLAS_URI not found in environment or .env file")
        print("\nPlease set ATLAS_URI in corpus/.env file:")
        print("  ATLAS_URI=mongodb+srv://user:pass@cluster.mongodb.net/")
        print("\nOr set it as environment variable:")
        print("  export ATLAS_URI='mongodb+srv://user:pass@cluster.mongodb.net/'")
        sys.exit(1)
    
    print(f"Local URI: {local_uri}")
    print(f"Atlas URI: {atlas_uri[:50]}...")
    print("=" * 60)
    
    # Verify both databases
    success = True
    success = verify_database(local_uri, atlas_uri, "hitopadesa") and success
    success = verify_database(local_uri, atlas_uri, "pancatantra") and success
    
    print(f"\n{Colors.GREEN}{'=' * 60}")
    if success:
        print("✓ Verification passed! All collections match.")
    else:
        print("✗ Verification failed! Check errors above.")
    print("=" * 60)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

