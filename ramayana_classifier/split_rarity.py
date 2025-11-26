import json
import logging
from collections import Counter
from pathlib import Path
from typing import Dict, List

INPUT_JSON = Path("shlokas_with_metrics.json")
OUTPUT_JSON = Path("shlokas_with_rarity.json")


def normalize_token(token: str) -> str:
    """Strip common punctuation markers from a token."""
    if not token:
        return ""
    return token.strip("।॥.,;:?!-—\"'()[]{}")


def load_records() -> List[Dict]:
    if not INPUT_JSON.exists():
        raise FileNotFoundError(f"Could not find {INPUT_JSON}. Generate it first.")
    with INPUT_JSON.open("r", encoding="utf-8") as f:
        return json.load(f)


def build_split_frequency(records: List[Dict]) -> Counter:
    freq = Counter()
    for record in records:
        splits = record.get("sandhi_splits", {})
        for parts in splits.values():
            for token in parts or []:
                normalized = normalize_token(token)
                if normalized:
                    freq[normalized] += 1
    logging.info("Collected frequency for %s unique split tokens.", len(freq))
    return freq


def compute_split_word_stats(splits: Dict[str, List[str]], freq: Counter) -> Dict[str, float]:
    split_tokens: List[str] = []
    for parts in splits.values():
        for token in parts or []:
            normalized = normalize_token(token)
            if normalized:
                split_tokens.append(normalized)

    split_word_count = len(split_tokens)
    rarity_score = 0.0
    if split_tokens:
        rarity_score = sum(1.0 / freq.get(token, 1) for token in split_tokens) / split_word_count

    return {
        "split_word_count": split_word_count,
        "rarity_score": round(rarity_score, 6),
    }


def normalize(values: List[float]) -> List[float]:
    if not values:
        return []
    min_val = min(values)
    max_val = max(values)
    if max_val - min_val < 1e-9:
        return [0.5 for _ in values]
    return [(val - min_val) / (max_val - min_val) for val in values]


def augment_records(records: List[Dict]) -> List[Dict]:
    freq = build_split_frequency(records)

    temp_store = []
    rarity_values: List[float] = []
    split_complexity_values: List[float] = []

    for record in records:
        splits = record.get("sandhi_splits", {})
        split_stats = compute_split_word_stats(splits, freq)
        split_complexity = record.get("metrics", {}).get("split_complexity_score", 0.0) or 0.0

        temp_store.append({
            "record": record,
            "split_word_count": split_stats["split_word_count"],
            "rarity_score": split_stats["rarity_score"],
            "split_complexity_score": split_complexity,
        })
        rarity_values.append(split_stats["rarity_score"])
        split_complexity_values.append(split_complexity)

    norm_rarity = normalize(rarity_values)
    norm_complexity = normalize(split_complexity_values)

    augmented = []
    for idx, item in enumerate(temp_store):
        base = item["record"]
        combined_complexity = round(
            (norm_rarity[idx] + norm_complexity[idx]) / 2 if norm_rarity else 0.0,
            6,
        )

        new_record = {
            "kanda": base.get("kanda"),
            "sarga": base.get("sarga"),
            "shloka": base.get("shloka"),
            "shloka_text": base.get("shloka_text"),
            "transliteration": base.get("transliteration"),
            "translation": base.get("translation"),
            "explanation": base.get("explanation"),
            "comments": base.get("comments"),
            "metrics": {
                "split_word_count": item["split_word_count"],
                "split_complexity_score": item["split_complexity_score"],
                "rarity_score": item["rarity_score"],
                "complexity_score": combined_complexity,
            },
        }
        augmented.append(new_record)

    logging.info("Augmented %s records.", len(augmented))
    if rarity_values:
        logging.info(
            "Rarity score stats -> min: %.6f, max: %.6f, mean: %.6f",
            min(rarity_values),
            max(rarity_values),
            sum(rarity_values) / len(rarity_values),
        )
    if split_complexity_values:
        logging.info(
            "Split complexity stats -> min: %.6f, max: %.6f, mean: %.6f",
            min(split_complexity_values),
            max(split_complexity_values),
            sum(split_complexity_values) / len(split_complexity_values),
        )
    return augmented


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    records = load_records()
    augmented = augment_records(records)

    with OUTPUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(augmented, f, ensure_ascii=False, indent=2)
    logging.info("Wrote augmented records to %s", OUTPUT_JSON)
    print(f"Augmented data saved to {OUTPUT_JSON} ({len(augmented)} records)")


if __name__ == "__main__":
    main()

