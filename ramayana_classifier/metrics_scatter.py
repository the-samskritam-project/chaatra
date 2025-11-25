import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Sequence
import random

import matplotlib.pyplot as plt

DATA_PATH = Path("shlokas_with_rarity.json")
PLOTS_DIR = Path("plots")
# Limit number of shlokas plotted to avoid dense visuals (None = all)
SAMPLE_SIZE: Optional[int] = 20000
RANDOM_SEED = 42

# Metric key -> human readable label
METRICS_TO_PLOT: Dict[str, str] = {
    "avg_word_length": "Average Word Length per Shloka",
    "split_complexity_score": "Split Complexity Score per Shloka",
    "rarity_score": "Average Rarity Score per Shloka",
    "complexity_score": "Combined Complexity Score per Shloka",
}

HISTOGRAM_METRICS = list(METRICS_TO_PLOT.keys())


def load_records(json_path: Path) -> List[Dict]:
    if not json_path.exists():
        raise FileNotFoundError(f"Could not find {json_path}. Generate it before running scatter plots.")
    logging.info("Loading data from %s", json_path)
    with json_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def sample_records(records: Sequence[Dict]) -> List[Dict]:
    if SAMPLE_SIZE is None or SAMPLE_SIZE >= len(records):
        logging.info("Using all %s records (no sampling).", len(records))
        return list(records)

    random.seed(RANDOM_SEED)
    sampled = random.sample(list(records), SAMPLE_SIZE)
    logging.info("Sampled %s records out of %s.", len(sampled), len(records))
    return sampled


def extract_metric_series(records: List[Dict]) -> Dict[str, List[float]]:
    series: Dict[str, List[float]] = {key: [] for key in METRICS_TO_PLOT}
    for record in records:
        metrics = record.get("metrics", {})
        for key in METRICS_TO_PLOT:
            value = metrics.get(key)
            # Skip if metric missing; keeps indexes aligned by duplicating None
            series[key].append(value if value is not None else 0.0)
    return series


def plot_metric(metric_key: str, values: List[float], output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    plot_path = output_dir / f"{metric_key}.png"

    plt.figure(figsize=(10, 4))
    plt.scatter(range(1, len(values) + 1), values, s=12, alpha=0.7, edgecolors="none")
    plt.title(METRICS_TO_PLOT[metric_key])
    plt.xlabel("Shloka Index")
    plt.ylabel(metric_key)
    plt.grid(alpha=0.2, linestyle="--")
    plt.tight_layout()
    plt.savefig(plot_path, dpi=200)
    plt.close()

    return plot_path


def plot_histogram(metric_key: str, values: List[float], output_dir: Path, bins: int = 40) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    plot_path = output_dir / f"{metric_key}_hist.png"

    plt.figure(figsize=(8, 4))
    plt.hist(values, bins=bins, alpha=0.75, color="#4C72B0", edgecolor="white")
    plt.title(f"{METRICS_TO_PLOT[metric_key]} Distribution")
    plt.xlabel(metric_key)
    plt.ylabel("Frequency")
    plt.grid(alpha=0.2, linestyle="--")
    plt.tight_layout()
    plt.savefig(plot_path, dpi=200)
    plt.close()

    return plot_path


def generate_plots():
    records = load_records(DATA_PATH)
    records = sample_records(records)
    metric_series = extract_metric_series(records)

    generated_paths = []
    for metric_key, values in metric_series.items():
        path = plot_metric(metric_key, values, PLOTS_DIR)
        generated_paths.append(path)
        logging.info("Generated plot for %s -> %s", metric_key, path)

    print("Generated the following scatter plots:")
    for path in generated_paths:
        print(f" - {path}")

    hist_paths = []
    for metric_key in HISTOGRAM_METRICS:
        values = metric_series.get(metric_key, [])
        if not values:
            continue
        path = plot_histogram(metric_key, values, PLOTS_DIR)
        hist_paths.append(path)
        logging.info("Generated histogram for %s -> %s", metric_key, path)

    if hist_paths:
        print("\nGenerated the following histogram plots:")
        for path in hist_paths:
            print(f" - {path}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(message)s")
    generate_plots()

