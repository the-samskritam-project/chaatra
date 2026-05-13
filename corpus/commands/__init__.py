"""
Command registry for corpus processing commands.

Each command module registers itself here with metadata.
"""

from dataclasses import dataclass
from typing import Optional, Callable
import sys

from config import get_corpus_config


@dataclass
class CommandMetadata:
    """Metadata for a command."""
    name: str
    handler: Callable
    add_arguments: Optional[Callable] = None  # Function to add command-specific arguments
    requires_corpus: bool = True
    corpus_specific: Optional[str] = None  # e.g., 'bhagavad_gita' if command only works with that corpus


COMMAND_REGISTRY: dict[str, CommandMetadata] = {}


def register_command(
    name: str,
    handler: Callable,
    add_arguments: Optional[Callable] = None,
    requires_corpus: bool = True,
    corpus_specific: Optional[str] = None
):
    """
    Register a command handler with metadata.
    
    Args:
        name: Command name
        handler: Handler function (takes either (corpus_name, args) or (args))
        add_arguments: Optional function to add command-specific arguments to subparser
        requires_corpus: Whether corpus name is required
        corpus_specific: If command only works with specific corpus (e.g., 'bhagavad_gita')
    """
    COMMAND_REGISTRY[name] = CommandMetadata(
        name=name,
        handler=handler,
        add_arguments=add_arguments,
        requires_corpus=requires_corpus,
        corpus_specific=corpus_specific
    )


def resolve_command(command_name: str, corpus_name: Optional[str] = None):
    """
    Resolve and validate a command.
    
    Args:
        command_name: Name of the command to resolve
        corpus_name: Optional corpus name provided by user
        
    Returns:
        CommandMetadata if valid
        
    Raises:
        SystemExit: If command is invalid or validation fails
    """
    # Check if command exists
    if command_name not in COMMAND_REGISTRY:
        print(f"Error: Unknown command: {command_name}")
        sys.exit(1)
    
    metadata = COMMAND_REGISTRY[command_name]
    
    # Validate corpus requirements
    if metadata.requires_corpus:
        if not corpus_name:
            print(f"Error: Corpus name is required for {command_name} command")
            sys.exit(1)
        
        # Check if command is corpus-specific
        if metadata.corpus_specific:
            if corpus_name.lower() != metadata.corpus_specific.lower():
                print(f"Error: {command_name} command only works with {metadata.corpus_specific} corpus")
                sys.exit(1)
        else:
            # Validate corpus exists in config
            try:
                get_corpus_config(corpus_name)
            except ValueError as e:
                print(f"Error: {e}")
                sys.exit(1)
    
    return metadata


def get_all_command_names():
    """Get list of all registered command names."""
    return list(COMMAND_REGISTRY.keys())


# Import all command modules to trigger registration
from . import transliterate
from . import translate
from . import import_to_mongo
from . import generate_embeddings
from . import vector_search
from . import classify_verses
from . import build_intervals
from . import summarize_intervals
from . import create_interval_theme_docs
from . import generate_interval_theme_embeddings
from . import cluster_interval_themes
from . import generate_theme_nodes
from . import process_bhagavad_gita
from . import extract_chapters
from . import extract_aditya_hridaya_stotra
from . import summarise_bhagavad_gita
from . import classify_bhagavad_gita_themes
from . import generate_bhagavad_gita_embeddings
from . import import_apte_dictionary
from . import generate_apte_embeddings
from . import translate_subhashitas
from . import generate_word_mapping
from . import summarize_bhagavad_gita_chapters