#!/bin/bash
#
# Migrate MongoDB databases from local to Atlas
# Exports hitopadesa and pancatantra databases and imports them to Atlas
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load .env file if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}Loading environment variables from .env file...${NC}"
    # Export variables from .env, ignoring comments and empty lines
    set -a
    source "$ENV_FILE"
    set +a
fi

# Default values
LOCAL_URI="${LOCAL_MONGODB_URI:-mongodb://localhost:27017}"
BACKUP_DIR="${BACKUP_DIR:-./mongodb_backup}"
DROP_EXISTING="${DROP_EXISTING:-false}"

# Check if Atlas URI is provided
if [ -z "$ATLAS_URI" ]; then
    echo -e "${RED}Error: ATLAS_URI not found in environment or .env file${NC}"
    echo ""
    echo "Please set ATLAS_URI in corpus/.env file:"
    echo "  ATLAS_URI=mongodb+srv://user:pass@cluster.mongodb.net/"
    echo ""
    echo "Or set it as environment variable:"
    echo "  export ATLAS_URI='mongodb+srv://user:pass@cluster.mongodb.net/'"
    echo ""
    echo "Optional variables in .env:"
    echo "  LOCAL_MONGODB_URI - Local MongoDB URI (default: mongodb://localhost:27017)"
    echo "  DROP_EXISTING - Drop existing collections before import (default: false)"
    echo "  BACKUP_DIR - Backup directory path (default: ./mongodb_backup)"
    exit 1
fi

echo -e "${GREEN}MongoDB Migration to Atlas${NC}"
echo "================================"
echo "Local URI: $LOCAL_URI"
echo "Atlas URI: ${ATLAS_URI:0:30}..." # Show first 30 chars only
echo "Backup directory: $BACKUP_DIR"
echo "Drop existing: $DROP_EXISTING"
echo "================================"
echo ""

# Check if mongodump and mongorestore are available
if ! command -v mongodump &> /dev/null; then
    echo -e "${RED}Error: mongodump not found. Please install MongoDB Database Tools.${NC}"
    exit 1
fi

if ! command -v mongorestore &> /dev/null; then
    echo -e "${RED}Error: mongorestore not found. Please install MongoDB Database Tools.${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✓${NC} Created backup directory: $BACKUP_DIR"
echo ""

# Function to export database
export_database() {
    local db_name=$1
    echo -e "${YELLOW}Exporting $db_name database...${NC}"
    
    if mongodump --uri="$LOCAL_URI" --db="$db_name" --out="$BACKUP_DIR" --quiet; then
        echo -e "${GREEN}✓${NC} Exported $db_name database"
        return 0
    else
        echo -e "${RED}✗${NC} Failed to export $db_name database"
        return 1
    fi
}

# Function to import database
import_database() {
    local db_name=$1
    local backup_path="$BACKUP_DIR/$db_name"
    
    if [ ! -d "$backup_path" ]; then
        echo -e "${RED}✗${NC} Backup directory not found: $backup_path"
        return 1
    fi
    
    echo -e "${YELLOW}Importing $db_name database to Atlas...${NC}"
    
    local drop_flag=""
    if [ "$DROP_EXISTING" = "true" ]; then
        drop_flag="--drop"
        echo -e "${YELLOW}  (Will drop existing collections)${NC}"
    fi
    
    if mongorestore --uri="$ATLAS_URI" --db="$db_name" $drop_flag "$backup_path" --quiet; then
        echo -e "${GREEN}✓${NC} Imported $db_name database to Atlas"
        return 0
    else
        echo -e "${RED}✗${NC} Failed to import $db_name database"
        return 1
    fi
}

# Export databases
echo -e "${GREEN}Step 1: Exporting from local MongoDB${NC}"
echo "----------------------------------------"

export_database "hitopadesa"
export_database "pancatantra"

echo ""

# Import databases
echo -e "${GREEN}Step 2: Importing to Atlas${NC}"
echo "----------------------------------------"

import_database "hitopadesa"
import_database "pancatantra"

echo ""
echo -e "${GREEN}================================"
echo "Migration completed successfully!"
echo "================================"
echo ""
echo "Backup files are stored in: $BACKUP_DIR"
echo "You can delete this directory after verifying the migration."
echo ""

