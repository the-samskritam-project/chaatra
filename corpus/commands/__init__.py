"""
Command registry for corpus processing commands.

Each command module registers itself here.
"""

COMMAND_REGISTRY = {}


def register_command(name: str, handler):
    """Register a command handler."""
    COMMAND_REGISTRY[name] = handler


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

