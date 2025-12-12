#!/usr/bin/env python3
"""
Migrate MongoDB databases from local to Atlas.

Exports hitopadesa and pancatantra databases and imports them to Atlas.
Provides more control and better error handling than shell script.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path
from typing import Optional

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
    NC = '\033[0m'  # No Color


def print_error(message: str):
    """Print error message."""
    print(f"{Colors.RED}✗{Colors.NC} {message}")


def print_success(message: str):
    """Print success message."""
    print(f"{Colors.GREEN}✓{Colors.NC} {message}")


def print_info(message: str):
    """Print info message."""
    print(f"{Colors.BLUE}ℹ{Colors.NC} {message}")


def print_warning(message: str):
    """Print warning message."""
    print(f"{Colors.YELLOW}⚠{Colors.NC} {message}")


def check_command(command: str) -> bool:
    """Check if a command is available."""
    return shutil.which(command) is not None


def run_command(cmd: list, description: str, quiet: bool = False) -> bool:
    """Run a shell command and return success status."""
    try:
        if not quiet:
            print(f"  Running: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=quiet,
            text=True,
            check=False
        )
        
        if result.returncode == 0:
            return True
        else:
            if quiet:
                print_error(f"{description} failed")
                if result.stderr:
                    print(f"  Error: {result.stderr}")
            return False
    except Exception as e:
        print_error(f"{description} failed: {e}")
        return False


def export_database(local_uri: str, db_name: str, backup_dir: Path) -> bool:
    """Export a database using mongodump."""
    print(f"\n{Colors.YELLOW}Exporting {db_name} database...{Colors.NC}")
    
    cmd = [
        "mongodump",
        "--uri", local_uri,
        "--db", db_name,
        "--out", str(backup_dir)
    ]
    
    if run_command(cmd, f"Export {db_name}", quiet=True):
        print_success(f"Exported {db_name} database")
        return True
    else:
        print_error(f"Failed to export {db_name} database")
        return False


def import_database(atlas_uri: str, db_name: str, backup_dir: Path, drop_existing: bool = False) -> bool:
    """Import a database using mongorestore."""
    backup_path = backup_dir / db_name
    
    if not backup_path.exists():
        print_error(f"Backup directory not found: {backup_path}")
        return False
    
    print(f"\n{Colors.YELLOW}Importing {db_name} database to Atlas...{Colors.NC}")
    
    if drop_existing:
        print_warning("  (Will drop existing collections)")
    
    cmd = [
        "mongorestore",
        "--uri", atlas_uri,
        "--db", db_name
    ]
    
    if drop_existing:
        cmd.append("--drop")
    
    cmd.append(str(backup_path))
    
    if run_command(cmd, f"Import {db_name}", quiet=True):
        print_success(f"Imported {db_name} database to Atlas")
        return True
    else:
        print_error(f"Failed to import {db_name} database")
        return False


def export_collection(local_uri: str, db_name: str, collection_name: str, backup_dir: Path) -> bool:
    """Export a specific collection using mongodump."""
    print(f"\n{Colors.YELLOW}Exporting {db_name}.{collection_name} collection...{Colors.NC}")
    
    cmd = [
        "mongodump",
        "--uri", local_uri,
        "--db", db_name,
        "--collection", collection_name,
        "--out", str(backup_dir)
    ]
    
    if run_command(cmd, f"Export {db_name}.{collection_name}", quiet=True):
        print_success(f"Exported {db_name}.{collection_name} collection")
        return True
    else:
        print_error(f"Failed to export {db_name}.{collection_name} collection")
        return False


def import_collection(
    atlas_uri: str,
    target_db: str,
    target_collection: str,
    source_db: str,
    source_collection: str,
    backup_dir: Path,
    drop_existing: bool = False
) -> bool:
    """Import a collection with renaming using mongorestore."""
    # Find the backup file
    backup_path = backup_dir / source_db / f"{source_collection}.bson"
    
    if not backup_path.exists():
        print_error(f"Backup file not found: {backup_path}")
        return False
    
    print(f"\n{Colors.YELLOW}Importing {source_db}.{source_collection} → {target_db}.{target_collection}...{Colors.NC}")
    
    if drop_existing:
        print_warning("  (Will drop existing collection)")
    
    cmd = [
        "mongorestore",
        "--uri", atlas_uri,
        "--db", target_db,
        "--collection", target_collection,
        "--drop" if drop_existing else "",
        str(backup_path)
    ]
    
    # Remove empty string if drop_existing is False
    cmd = [c for c in cmd if c]
    
    if run_command(cmd, f"Import {target_db}.{target_collection}", quiet=True):
        print_success(f"Imported {target_db}.{target_collection} collection")
        return True
    else:
        print_error(f"Failed to import {target_db}.{target_collection} collection")
        return False


def migrate_embeddings(
    local_uri: str,
    atlas_uri: str,
    backup_dir: Path,
    target_db: str = "corpus_vectors",
    drop_existing: bool = False
) -> bool:
    """Migrate embedding collections from local to Atlas with renaming."""
    print(f"\n{Colors.GREEN}Migrating Embeddings to Atlas{Colors.NC}")
    print("=" * 60)
    print(f"Target database: {target_db}")
    print(f"Collections:")
    print(f"  hitopadesa.corpus_vector_search → {target_db}.hitopadesa_vector_search")
    print(f"  pancatantra.corpus_vector_search → {target_db}.pancatantra_vector_search")
    print("=" * 60)
    
    # Export embeddings from local
    print(f"\n{Colors.GREEN}Step 1: Exporting embeddings from local MongoDB{Colors.NC}")
    print("-" * 60)
    
    success = True
    success = export_collection(local_uri, "hitopadesa", "corpus_vector_search", backup_dir) and success
    success = export_collection(local_uri, "pancatantra", "corpus_vector_search", backup_dir) and success
    
    if not success:
        print_error("Export failed. Aborting embedding migration.")
        return False
    
    # Import embeddings to Atlas with renaming
    print(f"\n{Colors.GREEN}Step 2: Importing embeddings to Atlas{Colors.NC}")
    print("-" * 60)
    
    success = True
    success = import_collection(
        atlas_uri, target_db, "hitopadesa_vector_search",
        "hitopadesa", "corpus_vector_search",
        backup_dir, drop_existing
    ) and success
    
    success = import_collection(
        atlas_uri, target_db, "pancatantra_vector_search",
        "pancatantra", "corpus_vector_search",
        backup_dir, drop_existing
    ) and success
    
    if not success:
        print_error("Import failed. Check errors above.")
        return False
    
    print_success("Embedding migration completed!")
    print_info(f"Next steps:")
    print_info(f"  1. Create vector search indexes in Atlas UI for:")
    print_info(f"     - {target_db}.hitopadesa_vector_search")
    print_info(f"     - {target_db}.pancatantra_vector_search")
    print_info(f"  2. Run: python scripts/create_atlas_vector_index.py")
    print_info(f"     for index definition JSON")
    
    return True


def verify_connection(uri: str, description: str) -> bool:
    """Verify MongoDB connection."""
    print(f"\n{Colors.BLUE}Verifying {description} connection...{Colors.NC}")
    
    cmd = ["mongosh", uri, "--eval", "db.adminCommand('ping')", "--quiet"]
    
    # Try mongosh first, fallback to mongo
    if not check_command("mongosh"):
        cmd = ["mongo", uri, "--eval", "db.adminCommand('ping')", "--quiet"]
        if not check_command("mongo"):
            print_warning("Cannot verify connection (mongosh/mongo not found)")
            return True  # Continue anyway
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    return result.returncode == 0


def main():
    """Main migration function."""
    # Load .env file if it exists
    script_dir = Path(__file__).parent
    env_file = script_dir.parent / ".env"
    
    if env_file.exists():
        if HAS_DOTENV:
            load_dotenv(dotenv_path=env_file)
            print_success("Loaded environment variables from .env file")
        else:
            print_warning(".env file found but python-dotenv not installed")
            print_info("Install with: pip install python-dotenv")
            print_info("Or set environment variables manually")
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
                print_success("Loaded environment variables from .env file (manual parsing)")
            except Exception as e:
                print_warning(f"Could not parse .env file: {e}")
    
    print(f"{Colors.GREEN}MongoDB Migration to Atlas{Colors.NC}")
    print("=" * 60)
    
    # Check prerequisites
    if not check_command("mongodump"):
        print_error("mongodump not found. Please install MongoDB Database Tools.")
        sys.exit(1)
    
    if not check_command("mongorestore"):
        print_error("mongorestore not found. Please install MongoDB Database Tools.")
        sys.exit(1)
    
    # Parse command line arguments
    import argparse
    parser = argparse.ArgumentParser(description='Migrate MongoDB databases and embeddings to Atlas')
    parser.add_argument(
        '--migrate-embeddings',
        action='store_true',
        help='Migrate embedding collections (corpus_vector_search) to unified database'
    )
    parser.add_argument(
        '--vector-database',
        default=os.getenv("MONGODB_VECTOR_DATABASE", "corpus_vectors"),
        help='Target database for embeddings (default: corpus_vectors)'
    )
    parser.add_argument(
        '--skip-databases',
        action='store_true',
        help='Skip migrating regular databases (only migrate embeddings)'
    )
    args = parser.parse_args()
    
    # Get configuration from environment
    local_uri = os.getenv("LOCAL_MONGODB_URI", "mongodb://localhost:27017")
    atlas_uri = os.getenv("ATLAS_URI")
    drop_existing = os.getenv("DROP_EXISTING", "false").lower() == "true"
    backup_dir = Path(os.getenv("BACKUP_DIR", "./mongodb_backup"))
    
    if not atlas_uri:
        print_error("ATLAS_URI not found in environment or .env file")
        print("\nPlease set ATLAS_URI in corpus/.env file:")
        print("  ATLAS_URI=mongodb+srv://user:pass@cluster.mongodb.net/")
        print("\nOr set it as environment variable:")
        print("  export ATLAS_URI='mongodb+srv://user:pass@cluster.mongodb.net/'")
        print("\nOptional variables in .env:")
        print("  LOCAL_MONGODB_URI - Local MongoDB URI (default: mongodb://localhost:27017)")
        print("  DROP_EXISTING - Drop existing collections before import (default: false)")
        print("  BACKUP_DIR - Backup directory path (default: ./mongodb_backup)")
        sys.exit(1)
    
    # Display configuration
    print(f"Local URI: {local_uri}")
    print(f"Atlas URI: {atlas_uri[:50]}...")  # Show first 50 chars
    print(f"Backup directory: {backup_dir}")
    print(f"Drop existing: {drop_existing}")
    print("=" * 60)
    print()
    
    # Verify connections (optional, but helpful)
    verify_connection(local_uri, "local MongoDB")
    verify_connection(atlas_uri, "Atlas")
    
    # Create backup directory
    backup_dir.mkdir(parents=True, exist_ok=True)
    print_success(f"Created backup directory: {backup_dir}")
    
    # Migrate embeddings if requested
    if args.migrate_embeddings or args.skip_databases:
        if not migrate_embeddings(local_uri, atlas_uri, backup_dir, args.vector_database, drop_existing):
            print_error("Embedding migration failed.")
            sys.exit(1)
        
        if args.skip_databases:
            # Only embeddings, we're done
            print(f"\n{Colors.GREEN}{'=' * 60}")
            print("Embedding migration completed successfully!")
            print("=" * 60)
            print()
            print(f"Backup files are stored in: {backup_dir}")
            print("You can delete this directory after verifying the migration.")
            print()
            return
    
    # Migrate regular databases (unless skipped)
    if not args.skip_databases:
        # Export databases
        print(f"\n{Colors.GREEN}Step 1: Exporting from local MongoDB{Colors.NC}")
        print("-" * 60)
        
        success = True
        success = export_database(local_uri, "hitopadesa", backup_dir) and success
        success = export_database(local_uri, "pancatantra", backup_dir) and success
        
        if not success:
            print_error("Export failed. Aborting migration.")
            sys.exit(1)
        
        # Import databases
        print(f"\n{Colors.GREEN}Step 2: Importing to Atlas{Colors.NC}")
        print("-" * 60)
        
        success = True
        success = import_database(atlas_uri, "hitopadesa", backup_dir, drop_existing) and success
        success = import_database(atlas_uri, "pancatantra", backup_dir, drop_existing) and success
        
        if not success:
            print_error("Import failed. Check errors above.")
            sys.exit(1)
    
    # Migrate embeddings if requested (in addition to databases)
    if args.migrate_embeddings and not args.skip_databases:
        if not migrate_embeddings(local_uri, atlas_uri, backup_dir, args.vector_database, drop_existing):
            print_warning("Embedding migration failed, but database migration succeeded.")
    
    # Success message
    print(f"\n{Colors.GREEN}{'=' * 60}")
    print("Migration completed successfully!")
    print("=" * 60)
    print()
    print(f"Backup files are stored in: {backup_dir}")
    print("You can delete this directory after verifying the migration.")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Migration interrupted by user.{Colors.NC}")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)

