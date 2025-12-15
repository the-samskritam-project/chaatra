"""Constants for verse classification."""

import textwrap

ALLOWED_LABELS = {
    "invocation",
    "narrative",
    "generalization",
    "commentary",
    "transition",
}

PROMPT_TEMPLATE = textwrap.dedent(
    """
    Classify the following Panchatantra verse by its primary narrative function.

    Possible labels:
    - invocation
    - narrative
    - generalization
    - commentary
    - transition

    Definitions:
    - invocation: salutations, lineage, authorial homage, auspicious opening
    - narrative: describes events, actions, or dialogue
    - generalization: expresses a general principle inferred from events
    - commentary: reflects on or evaluates a situation or action
    - transition: signals movement between stories or scenes

    Rules:
    - Choose exactly one label
    - Base the classification only on the verse meaning
    - Do not invent missing context
    - If unsure, choose the most dominant function

    Verse (English translation):
    {full_translation}

    Return only the label.
    """
).strip()
