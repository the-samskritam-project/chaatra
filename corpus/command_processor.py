#!/usr/bin/env python3
"""
Command processor for corpus processing.

Takes a command and executes the appropriate processing step.
"""

import os
import sys
import argparse

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from commands import COMMAND_REGISTRY, resolve_command
from commands.common_args import add_common_args


def main():
    """Main CLI entry point."""
    # Load environment variables
    if load_dotenv:
        env_path = os.path.join(os.path.dirname(__file__), '.env')
        if os.path.exists(env_path):
            load_dotenv(dotenv_path=env_path)
    
    parser = argparse.ArgumentParser(
        description='Process corpus files (transliterate, translate, import to MongoDB)',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    # Create subparsers for each command
    subparsers = parser.add_subparsers(dest='command', help='Command to execute', metavar='COMMAND')
    
    # Register all commands with their subparsers
    for name, metadata in COMMAND_REGISTRY.items():
        subparser = subparsers.add_parser(name, help=f'Execute {name} command')
        
        # Add corpus argument if required
        if metadata.requires_corpus:
            subparser.add_argument(
                'corpus',
                help='Corpus name (e.g., hitopadesa, pancatantra)'
            )
        
        # Add common arguments
        add_common_args(subparser)
        
        # Add command-specific arguments
        if metadata.add_arguments:
            metadata.add_arguments(subparser)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Resolve and validate command using registry
    try:
        corpus = getattr(args, 'corpus', None)
        metadata = resolve_command(args.command, corpus)
        
        # Execute command based on handler signature
        if metadata.requires_corpus:
            metadata.handler(corpus, args)
        else:
            metadata.handler(args)
    except KeyboardInterrupt:
        print("\n\n⚠ Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
