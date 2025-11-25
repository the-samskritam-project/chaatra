import json
import logging
from typing import Dict, List

from indic_transliteration import sanscript
from sanskrit_parser.base.sanskrit_base import SanskritObject
from sanskrit_parser.parser.sandhi_analyzer import LexicalSandhiAnalyzer

logging.basicConfig(level=logging.WARNING)
logging.getLogger("sanskrit_parser").setLevel(logging.WARNING)
logging.getLogger("sanskrit_parser.parser").setLevel(logging.WARNING)

JSON_PATH = "valmiki_ramayan_shlokas.json"
OUTPUT_JSON_PATH = "shlokas_with_metrics.json"


def format_split(path) -> List[str]:
    return [token.transcoded(sanscript.DEVANAGARI) for token in path]


def get_splits(word: str, analyzer: LexicalSandhiAnalyzer, max_paths: int = 5):
    so = SanskritObject(word, encoding=sanscript.DEVANAGARI)
    graph = analyzer.getSandhiSplits(so, tag=False, pre_segmented=False)
    if not graph:
        return []
    paths = graph.find_all_paths(max_paths=max_paths, score=True)
    if not paths:
        return []
    return [format_split(path) for path in paths]


def analyze_text(text: str, analyzer: LexicalSandhiAnalyzer) -> Dict[str, List[str]]:
    split_map: Dict[str, List[str]] = {}
    for word in text.split():
        if word == "।" or (word.startswith("।।") and word.endswith("।।")):
            continue
        splits = get_splits(word, analyzer)
        split_map[word] = splits[0] if splits else [word]
    return split_map


def compute_metrics(text: str, split_map: Dict[str, List[str]]) -> dict:
    """Compute comprehensive metrics from text and sandhi splits"""
    # Get words from text (excluding punctuation markers)
    words = [w for w in text.split() if w != "।" and not (w.startswith("।।") and w.endswith("।।"))]
    
    # Word and Character Length Metrics
    total_words = len(words)
    total_chars = len(text.replace(" ", ""))
    word_lengths = [len(w) for w in words]
    min_word_length = min(word_lengths) if word_lengths else 0
    max_word_length = max(word_lengths) if word_lengths else 0
    avg_word_length = sum(word_lengths) / total_words if total_words > 0 else 0
    
    # Split Success Metrics
    # A word is considered split if it has more than 1 part
    words_with_splits = sum(1 for split in split_map.values() if len(split) > 1)
    words_without_splits = sum(1 for split in split_map.values() if len(split) == 1)
    split_success_ratio = words_with_splits / total_words if total_words > 0 else 0
    
    # Split Complexity Metrics
    # total_split_parts includes all parts (unsplit words count as 1 part each)
    all_split_lengths = [len(split) for split in split_map.values()]
    total_split_parts = sum(all_split_lengths)
    
    # For avg/max/min, only consider words that were actually split (len > 1)
    split_parts_counts = [len(split) for split in split_map.values() if len(split) > 1]
    avg_parts_per_split_word = sum(split_parts_counts) / len(split_parts_counts) if split_parts_counts else 0
    max_parts_in_any_split = max(split_parts_counts) if split_parts_counts else 0
    min_parts_in_any_split = min(split_parts_counts) if split_parts_counts else 0
    
    # Composite Metrics
    split_complexity_score = total_split_parts / total_words if total_words > 0 else 0
    unsplit_word_ratio = words_without_splits / total_words if total_words > 0 else 0
    
    return {
        # Word and Character Length Metrics
        "total_words": total_words,
        "total_chars": total_chars,
        "min_word_length": min_word_length,
        "max_word_length": max_word_length,
        "avg_word_length": round(avg_word_length, 2),
        
        # Split Success Metrics
        "words_with_splits": words_with_splits,
        "words_without_splits": words_without_splits,
        "split_success_ratio": round(split_success_ratio, 3),
        
        # Split Complexity Metrics
        "total_split_parts": total_split_parts,
        "avg_parts_per_split_word": round(avg_parts_per_split_word, 2),
        "max_parts_in_any_split": max_parts_in_any_split,
        "min_parts_in_any_split": min_parts_in_any_split,
        
        # Composite Metrics
        "split_complexity_score": round(split_complexity_score, 3),
        "unsplit_word_ratio": round(unsplit_word_ratio, 3),
    }


def aggregate_statistics(all_metrics: List[dict]) -> dict:
    """Compute aggregate statistics across all shlokas"""
    if not all_metrics:
        return {}
    
    # Collect all values for each metric
    metric_keys = all_metrics[0].keys()
    aggregated = {}
    
    for key in metric_keys:
        values = [m[key] for m in all_metrics if key in m]
        if not values:
            continue
        
        # For numeric metrics, compute min, max, avg
        if isinstance(values[0], (int, float)):
            aggregated[f"{key}_min"] = min(values)
            aggregated[f"{key}_max"] = max(values)
            aggregated[f"{key}_avg"] = round(sum(values) / len(values), 3)
        else:
            aggregated[f"{key}_values"] = values
    
    aggregated["total_shlokas"] = len(all_metrics)
    return aggregated


def main():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        shlokas = json.load(f)

    analyzer = LexicalSandhiAnalyzer()
    all_metrics = []
    output_data = []

    for idx, item in enumerate(shlokas[:5], start=1):
        text = item.get("shloka_text")
        if not text:
            continue
        split_map = analyze_text(text, analyzer)
        metrics = compute_metrics(text, split_map)
        all_metrics.append(metrics)
        kanda = item.get("kanda")
        sarga = item.get("sarga")
        shloka_no = item.get("shloka")
        transliteration = item.get("transliteration")
        translation = item.get("translation")
        explanation = item.get("explanation")
        comments = item.get("comments")
        
        # Build complete record for JSON output
        record = {
            # Original fields
            "kanda": kanda,
            "sarga": sarga,
            "shloka": shloka_no,
            "shloka_text": text,
            "transliteration": transliteration,
            "translation": translation,
            "explanation": explanation,
            "comments": comments,
            # Computed metrics
            "metrics": metrics,
            # Sandhi splits
            "sandhi_splits": split_map
        }
        output_data.append(record)
        
        print(f"Shloka #{idx} ({kanda}, sarga {sarga}, shloka {shloka_no}):")
        print("-" * 80)
        
        # Sanskrit Text
        print("Sanskrit Text:")
        print(f"  {text}")
        print()
        
        # Transliteration
        if transliteration:
            print("Transliteration:")
            print(f"  {transliteration}")
            print()
        
        # Translation
        if translation:
            print("Translation:")
            print(f"  {translation}")
            print()
        
        # Explanation
        if explanation:
            print("Explanation:")
            print(f"  {explanation}")
            print()
        
        # Comments
        if comments:
            print("Comments:")
            print(f"  {comments}")
            print()
        
        # Metrics
        print("Metrics:")
        print(f"  Word/Char Length: words={metrics['total_words']}, chars={metrics['total_chars']}, "
              f"min={metrics['min_word_length']}, max={metrics['max_word_length']}, "
              f"avg={metrics['avg_word_length']}")
        print(f"  Split Success: with_splits={metrics['words_with_splits']}, "
              f"without_splits={metrics['words_without_splits']}, "
              f"ratio={metrics['split_success_ratio']}")
        print(f"  Split Complexity: total_parts={metrics['total_split_parts']}, "
              f"avg_parts={metrics['avg_parts_per_split_word']}, "
              f"min={metrics['min_parts_in_any_split']}, max={metrics['max_parts_in_any_split']}")
        print(f"  Composite: complexity_score={metrics['split_complexity_score']}, "
              f"unsplit_ratio={metrics['unsplit_word_ratio']}")
        print()
        
        # Splits
        print("Splits:")
        for word, split in split_map.items():
            print(f"  {word} -> {split}")
        print()
        print("=" * 80)
        print()
    
    # Display aggregate statistics
    if all_metrics:
        print("=" * 80)
        print("AGGREGATE STATISTICS ACROSS ALL SHLOKAS")
        print("=" * 80)
        agg_stats = aggregate_statistics(all_metrics)
        
        print(f"\nTotal Shlokas Processed: {agg_stats['total_shlokas']}")
        
        print("\nWord/Char Length Metrics (min, max, avg):")
        print(f"  total_words: min={agg_stats.get('total_words_min')}, max={agg_stats.get('total_words_max')}, avg={agg_stats.get('total_words_avg')}")
        print(f"  total_chars: min={agg_stats.get('total_chars_min')}, max={agg_stats.get('total_chars_max')}, avg={agg_stats.get('total_chars_avg')}")
        print(f"  min_word_length: min={agg_stats.get('min_word_length_min')}, max={agg_stats.get('min_word_length_max')}, avg={agg_stats.get('min_word_length_avg')}")
        print(f"  max_word_length: min={agg_stats.get('max_word_length_min')}, max={agg_stats.get('max_word_length_max')}, avg={agg_stats.get('max_word_length_avg')}")
        print(f"  avg_word_length: min={agg_stats.get('avg_word_length_min')}, max={agg_stats.get('avg_word_length_max')}, avg={agg_stats.get('avg_word_length_avg')}")
        
        print("\nSplit Success Metrics (min, max, avg):")
        print(f"  words_with_splits: min={agg_stats.get('words_with_splits_min')}, max={agg_stats.get('words_with_splits_max')}, avg={agg_stats.get('words_with_splits_avg')}")
        print(f"  words_without_splits: min={agg_stats.get('words_without_splits_min')}, max={agg_stats.get('words_without_splits_max')}, avg={agg_stats.get('words_without_splits_avg')}")
        print(f"  split_success_ratio: min={agg_stats.get('split_success_ratio_min')}, max={agg_stats.get('split_success_ratio_max')}, avg={agg_stats.get('split_success_ratio_avg')}")
        
        print("\nSplit Complexity Metrics (min, max, avg):")
        print(f"  total_split_parts: min={agg_stats.get('total_split_parts_min')}, max={agg_stats.get('total_split_parts_max')}, avg={agg_stats.get('total_split_parts_avg')}")
        print(f"  avg_parts_per_split_word: min={agg_stats.get('avg_parts_per_split_word_min')}, max={agg_stats.get('avg_parts_per_split_word_max')}, avg={agg_stats.get('avg_parts_per_split_word_avg')}")
        print(f"  max_parts_in_any_split: min={agg_stats.get('max_parts_in_any_split_min')}, max={agg_stats.get('max_parts_in_any_split_max')}, avg={agg_stats.get('max_parts_in_any_split_avg')}")
        print(f"  min_parts_in_any_split: min={agg_stats.get('min_parts_in_any_split_min')}, max={agg_stats.get('min_parts_in_any_split_max')}, avg={agg_stats.get('min_parts_in_any_split_avg')}")
        
        print("\nComposite Metrics (min, max, avg):")
        print(f"  split_complexity_score: min={agg_stats.get('split_complexity_score_min')}, max={agg_stats.get('split_complexity_score_max')}, avg={agg_stats.get('split_complexity_score_avg')}")
        print(f"  unsplit_word_ratio: min={agg_stats.get('unsplit_word_ratio_min')}, max={agg_stats.get('unsplit_word_ratio_max')}, avg={agg_stats.get('unsplit_word_ratio_avg')}")
        print()
    
    # Write output to JSON file
    if output_data:
        with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        print(f"Output written to {OUTPUT_JSON_PATH}")
        print(f"Total records: {len(output_data)}")


if __name__ == "__main__":
    main()

