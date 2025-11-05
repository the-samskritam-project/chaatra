"""
Main entry point for dictionary search system.

Usage:
    python main.py index              # Build search index
    python main.py query <text>       # Search dictionary (any language)
    python main.py query-slp1 <slp1>  # Search with SLP1 transliteration
"""

import sys
from commands.build_index import main as build_index
from commands.query import main as query


def main():
    """Route to appropriate command based on arguments."""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python main.py index")
        print("  python main.py query <search text>")
        print("  python main.py query-slp1 <slp1 text>")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "index":
        build_index()
    elif command == "query":
        if len(sys.argv) < 3:
            print("Error: Query command requires search text")
            print("Usage: python main.py query '<search text>'")
            sys.exit(1)
        query_text = " ".join(sys.argv[2:])
        query(query_text, transliterate=False)
    elif command == "query-slp1":
        if len(sys.argv) < 3:
            print("Error: Query-slp1 command requires SLP1 transliterated text")
            print("Usage: python main.py query-slp1 '<slp1 text>'")
            sys.exit(1)
        query_text = " ".join(sys.argv[2:])
        query(query_text, transliterate=True)
    else:
        print(f"Unknown command: {command}")
        print("Available commands: index, query, query-slp1")
        sys.exit(1)


if __name__ == "__main__":
    main()

