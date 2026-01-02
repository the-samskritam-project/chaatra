"""Common argument definitions shared across commands."""

import argparse


def add_common_args(parser: argparse.ArgumentParser):
    """Add common arguments to a parser."""
    parser.add_argument(
        '--mongodb-uri',
        help='MongoDB connection URI (or set MONGODB_URI env var)'
    )
    parser.add_argument(
        '--database',
        help='Database name (defaults to corpus name)'
    )


def add_batch_size_arg(parser: argparse.ArgumentParser, default: int = 10):
    """Add batch size argument."""
    parser.add_argument(
        '--batch-size',
        type=int,
        default=default,
        help=f'Batch size for processing (default: {default})'
    )


def add_api_key_arg(parser: argparse.ArgumentParser):
    """Add API key argument."""
    parser.add_argument(
        '--api-key',
        help='OpenAI API key (or set OPENAI_API_KEY env var)'
    )


def add_model_arg(parser: argparse.ArgumentParser, default: str = 'gpt-4o'):
    """Add model argument."""
    parser.add_argument(
        '--model',
        default=default,
        help=f'OpenAI model to use (default: {default}). Options: gpt-5.1, gpt-4o, gpt-4-turbo, gpt-4, o1-preview, o1-mini'
    )


def add_delay_arg(parser: argparse.ArgumentParser, default: float = 1.0):
    """Add delay argument."""
    parser.add_argument(
        '--delay',
        type=float,
        default=default,
        help=f'Delay between API calls in seconds (default: {default})'
    )

