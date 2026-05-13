"""Summarize Bhagavad Gita chapters command handler."""

import argparse
import os
import sys

from processor.summarize_bhagavad_gita_chapters import (
    summarize_bhagavad_gita_chapters,
)
from . import register_command
from .common_args import add_api_key_arg, add_common_args, add_model_arg


def handle(corpus_name: str, args):
    """Execute the summarize_bhagavad_gita_chapters command."""
    if corpus_name.lower() != "bhagavad_gita":
        print(
            "Error: summarize_bhagavad_gita_chapters command only works "
            "with bhagavad_gita corpus"
        )
        sys.exit(1)

    mongodb_uri = args.mongodb_uri or os.getenv("MONGODB_URI")
    if not mongodb_uri:
        print("Error: MONGODB_URI must be provided or set as environment variable")
        sys.exit(1)

    database_name = args.database or "bhagavad_gita_shankara_bhasya"

    start_chapter = getattr(args, "summary_start_chapter", None)
    end_chapter = getattr(args, "summary_end_chapter", None)

    api_key = (
        args.api_key
        or os.getenv("LANGCHAIN_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )
    if not api_key:
        print(
            "Error: OPENAI_API_KEY or LANGCHAIN_API_KEY must be provided or "
            "set as environment variable"
        )
        sys.exit(1)

    model = args.model or "gpt-5.1"
    delay = getattr(args, "summary_delay", 1.0)
    force = getattr(args, "summary_force", False)

    summarize_bhagavad_gita_chapters(
        mongodb_uri=mongodb_uri,
        database_name=database_name,
        start_chapter=start_chapter,
        end_chapter=end_chapter,
        api_key=api_key,
        model=model,
        delay=delay,
        force=force,
    )


def add_arguments(subparser: argparse.ArgumentParser):
    """Add arguments for the summarize_bhagavad_gita_chapters command."""
    add_common_args(subparser)
    add_api_key_arg(subparser)
    add_model_arg(subparser, default="gpt-5.1")
    subparser.add_argument(
        "--summary-start-chapter",
        type=int,
        help="First chapter to process (inclusive)",
    )
    subparser.add_argument(
        "--summary-end-chapter",
        type=int,
        help="Last chapter to process (inclusive)",
    )
    subparser.add_argument(
        "--summary-delay",
        type=float,
        default=1.0,
        help="Delay between API calls (seconds, default: 1.0)",
    )
    subparser.add_argument(
        "--summary-force",
        action="store_true",
        help="Overwrite existing chapter summaries",
    )


register_command(
    "summarize_bhagavad_gita_chapters",
    handle,
    add_arguments,
    requires_corpus=True,
    corpus_specific="bhagavad_gita",
)
