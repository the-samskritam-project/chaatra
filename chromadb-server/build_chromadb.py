#!/usr/bin/env python3
"""
Build ChromaDB indexes for dictionary and Ramayana datasets.
"""
import argparse
import json
import os
import sys

import chromadb
from sentence_transformers import SentenceTransformer

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Data files in the same directory as the script
DICTIONARY_DATA_PATH = os.getenv("DATA_PATH", os.path.join(SCRIPT_DIR, "parsed_dictionary.json"))
RAMAYANA_DATA_PATH = os.getenv(
    "RAMAYANA_DATA_PATH",
    os.path.join(SCRIPT_DIR, "valmiki_ramayan_shlokas_filtered.json")
)
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", SCRIPT_DIR)
CHROMA_SERVER_URL = os.getenv("CHROMA_SERVER_URL", "")  # e.g., "http://localhost:8000"
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"


def normalize(text):
    """Simple normalization"""
    return text.strip() if text else ""


def load_dictionary_data(path):
    """Load and transform dictionary entries"""
    with open(path, "r", encoding="utf-8") as f:
        rows = json.load(f)

    items = []
    for r in rows:
        head = normalize(r.get("slp1Str", ""))
        head_sanskrit = normalize(r.get("sanskritString", ""))
        meaning = normalize(r.get("meaning", ""))

        example_texts = []
        example_sanskrit = []
        for ex in r.get("examples", []):
            ex_slp1 = ex.get("slp1", "").strip()
            ex_sanskrit = ex.get("sanskrit", "").strip()
            if ex_slp1:
                if ex_sanskrit:
                    example_texts.append(f"{ex_slp1} — {ex_sanskrit}")
                else:
                    example_texts.append(ex_slp1)
            if ex_sanskrit:
                example_sanskrit.append(ex_sanskrit)

        text_parts = []
        if head_sanskrit:
            text_parts.append(f"{head} — {head_sanskrit} — {meaning}")
        else:
            text_parts.append(f"{head} — {meaning}")

        if example_texts:
            text_parts.append(" | ".join(example_texts))

        text_en = normalize(" | ".join(text_parts))

        sk_parts = []
        if head_sanskrit:
            sk_parts.append(head_sanskrit)
        if example_sanskrit:
            sk_parts.append(" | ".join(example_sanskrit))
        text_sk = normalize(" | ".join(sk_parts))
        if not text_sk:
            text_sk = head_sanskrit or head or meaning

        items.append({
            "id": r.get("id"),
            "sense": r.get("sense", ""),
            "headword": head,
            "sanskrit": head_sanskrit,
            "meaning": meaning,
            "partOfSpeech": r.get("partOfSpeech", ""),
            "examples": r.get("examples", []),
            "text_en": text_en,
            "text_sk": text_sk,
            "kanda": "",
            "sarga": "",
            "shloka": "",
            "transliteration": "",
            "explanation": "",
            "comments": "",
        })

    return items


def load_ramayana_data(path):
    """Load Valmiki Ramayana shlokas"""
    with open(path, "r", encoding="utf-8") as f:
        rows = json.load(f)

    items = []
    for r in rows:
        kanda = normalize(r.get("kanda", ""))
        sarga = r.get("sarga")
        shloka_no = r.get("shloka")
        shloka_text = normalize(r.get("shloka_text", ""))
        transliteration = normalize(r.get("transliteration", ""))
        translation = normalize(r.get("translation", ""))
        explanation = normalize(r.get("explanation", ""))
        comments = normalize(r.get("comments", ""))

        doc_en_parts = [translation, explanation, comments]
        text_en = normalize(" | ".join([p for p in doc_en_parts if p]))
        if not text_en:
            text_en = shloka_text or transliteration

        text_sk = shloka_text or transliteration or translation

        item_id = f"{kanda or 'kanda'}-{sarga}-{shloka_no}"

        items.append({
            "id": item_id,
            "sense": "",
            "headword": "",
            "sanskrit": shloka_text,
            "meaning": translation,
            "partOfSpeech": "",
            "examples": [],
            "text_en": text_en,
            "text_sk": text_sk,
            "kanda": kanda,
            "sarga": sarga,
            "shloka": shloka_no,
            "transliteration": transliteration,
            "explanation": explanation,
            "comments": comments,
        })

    return items


def get_collection_name(dataset, lang):
    if dataset == "dictionary":
        return "dictionary_sk" if lang == "sk" else "dictionary_en"
    return f"{dataset}_{lang}"


def build_index(items, dataset, lang, model_name, out_path):
    """Build ChromaDB index"""
    # Use HttpClient if CHROMA_SERVER_URL is set, otherwise use PersistentClient
    if CHROMA_SERVER_URL:
        from urllib.parse import urlparse
        print(f"DEBUG: CHROMA_SERVER_URL = {CHROMA_SERVER_URL}")
        parsed = urlparse(CHROMA_SERVER_URL)
        host = parsed.hostname or "localhost"
        # Use port 443 for HTTPS if no port specified, otherwise use specified port or default to 8000
        if parsed.port:
            port = parsed.port
        elif parsed.scheme == "https":
            port = 443
        else:
            port = 8000
        # Enable SSL for HTTPS
        ssl_enabled = parsed.scheme == "https"
        print(f"DEBUG: Parsed hostname = {host}, port = {port}, SSL = {ssl_enabled}")
        print(f"Connecting to ChromaDB server at {parsed.scheme}://{host}:{port} (SSL: {ssl_enabled})")
        try:
            client = chromadb.HttpClient(host=host, port=port, ssl=ssl_enabled)
            print(f"DEBUG: HttpClient created successfully")
        except Exception as e:
            print(f"DEBUG: Error creating HttpClient: {e}")
            raise
    else:
        print(f"Using persistent ChromaDB client at {out_path}")
        client = chromadb.PersistentClient(path=out_path)
    
    collection_name = get_collection_name(dataset, lang)
    texts = [it["text_sk"] for it in items] if lang == "sk" else [it["text_en"] for it in items]

    try:
        client.delete_collection(name=collection_name)
        print(f"Removed existing collection '{collection_name}'")
    except Exception:
        pass

    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"model_name": model_name, "lang": lang, "dataset": dataset}
    )

    print(f"Loading model {model_name}...")
    model = SentenceTransformer(model_name)

    print(f"Generating embeddings for {len(texts)} entries...")
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=True,
        batch_size=256,
        convert_to_numpy=True,
        device="cpu",
    )
    embeddings = embeddings.tolist()

    metadatas = []
    for it in items:
        metadata = {
            "dataset": dataset,
            "sense": it.get("sense", ""),
            "headword": it.get("headword", ""),
            "sanskrit": it.get("sanskrit", ""),
            "meaning": it.get("meaning", ""),
            "partOfSpeech": it.get("partOfSpeech", ""),
            "examples": json.dumps(it.get("examples", [])),
            "kanda": it.get("kanda", ""),
            "sarga": it.get("sarga"),
            "shloka": it.get("shloka"),
            "transliteration": it.get("transliteration", ""),
            "explanation": it.get("explanation", ""),
            "comments": it.get("comments", ""),
        }
        metadatas.append(metadata)

    batch_size = 5000
    total_items = len(items)

    print(f"Adding {total_items} entries to collection '{collection_name}'...")
    for i in range(0, total_items, batch_size):
        batch_end = min(i + batch_size, total_items)
        collection.add(
            ids=[it["id"] for it in items[i:batch_end]],
            embeddings=embeddings[i:batch_end],
            documents=texts[i:batch_end],
            metadatas=metadatas[i:batch_end],
        )
        print(f"  Processed {batch_end}/{total_items} entries", end="\r")

    if CHROMA_SERVER_URL:
        print(f"\nDone! Indexed {total_items} entries → ChromaDB server at {CHROMA_SERVER_URL} ({collection_name})")
    else:
        print(f"\nDone! Indexed {total_items} entries → {out_path} ({collection_name})")


def parse_args():
    parser = argparse.ArgumentParser(description="Build ChromaDB index")
    parser.add_argument(
        "--dataset",
        choices=["dictionary", "ramayana"],
        default="dictionary",
        help="Dataset to index",
    )
    parser.add_argument(
        "--lang",
        choices=["en", "sk"],
        default="en",
        help="Which collection to build: en (default) or sk (Sanskrit)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    if args.dataset == "dictionary":
        data_path = DICTIONARY_DATA_PATH
        loader = load_dictionary_data
    else:
        data_path = RAMAYANA_DATA_PATH
        loader = load_ramayana_data

    if not os.path.exists(data_path):
        print(f"Error: Data file not found at {data_path}")
        sys.exit(1)

    print(f"Loading {args.dataset} data from {data_path}...")
    items = loader(data_path)
    print(f"Loaded {len(items)} entries")

    if args.dataset == "ramayana" and args.lang == "sk":
        print("Warning: Ramayana Sanskrit index is experimental (Devanagari embeddings only).")

    print(f"Building ChromaDB index (dataset={args.dataset}, lang={args.lang})...")
    build_index(items, args.dataset, args.lang, MODEL_NAME, CHROMA_DB_PATH)
    print("Build complete!")

