import json
import logging
import random
from pathlib import Path
from typing import Dict, List

INPUT_PATH = Path("shlokas_with_rarity.json")
OUTPUT_PATH = Path("quartile_samples.json")
SAMPLE_SIZE_PER_QUARTILE = 20
RANDOM_SEED = 1234


def load_records() -> List[Dict]:
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Missing {INPUT_PATH}, run split_rarity.py first.")
    with INPUT_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def partition_quartiles(records: List[Dict]) -> Dict[str, List[Dict]]:
    sorted_records = sorted(
        records,
        key=lambda r: r.get("metrics", {}).get("complexity_score", 0.0),
    )
    n = len(sorted_records)
    quartiles = {}
    labels = ["Q1_low", "Q2_midlow", "Q3_midhigh", "Q4_high"]

    for idx, label in enumerate(labels):
        start = int(idx * n / 4)
        end = int((idx + 1) * n / 4) if idx < 3 else n
        quartiles[label] = sorted_records[start:end]
        logging.info("%s: records %s-%s (count=%s)", label, start, end, len(quartiles[label]))
    return quartiles


def sample_records(quartile_records: Dict[str, List[Dict]]) -> Dict[str, List[Dict]]:
    random.seed(RANDOM_SEED)
    samples = {}
    for label, records in quartile_records.items():
        if len(records) <= SAMPLE_SIZE_PER_QUARTILE:
            samples[label] = records
            continue
        samples[label] = random.sample(records, SAMPLE_SIZE_PER_QUARTILE)
    return samples


def format_entry(record: Dict) -> Dict:
    return {
        "kanda": record.get("kanda"),
        "sarga": record.get("sarga"),
        "shloka": record.get("shloka"),
        "shloka_text": record.get("shloka_text"),
        "metrics": record.get("metrics", {}),
    }


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    records = load_records()
    quartiles = partition_quartiles(records)
    samples = sample_records(quartiles)

    output = {label: [format_entry(r) for r in recs] for label, recs in samples.items()}

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Wrote quartile samples to {OUTPUT_PATH}")
    for label, recs in output.items():
        logging.info("%s: %s shlokas", label, len(recs))


if __name__ == "__main__":
    main()

