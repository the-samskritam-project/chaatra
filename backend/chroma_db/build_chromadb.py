#!/usr/bin/env python3
"""
Build ChromaDB index from dictionary JSON during Docker build.
"""
import json
import os
import sys
import chromadb
from sentence_transformers import SentenceTransformer

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.getenv("DATA_PATH", os.path.join(SCRIPT_DIR, "parsed_dictionary.json"))
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", SCRIPT_DIR)
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"

def normalize(text):
    """Simple normalization"""
    return text.strip() if text else ""

def load_data(path):
    """Load and transform dictionary entries"""
    with open(path, "r", encoding="utf-8") as f:
        rows = json.load(f)
    
    items = []
    for r in rows:
        head = normalize(r.get("slp1Str", ""))
        head_sanskrit = normalize(r.get("sanskritString", ""))
        meaning = normalize(r.get("meaning", ""))
        
        example_texts = []
        for ex in r.get("examples", []):
            ex_slp1 = ex.get("slp1", "").strip()
            ex_sanskrit = ex.get("sanskrit", "").strip()
            if ex_slp1:
                if ex_sanskrit:
                    example_texts.append(f"{ex_slp1} — {ex_sanskrit}")
                else:
                    example_texts.append(ex_slp1)
        
        text_parts = []
        if head_sanskrit:
            text_parts.append(f"{head} — {head_sanskrit} — {meaning}")
        else:
            text_parts.append(f"{head} — {meaning}")
        
        if example_texts:
            text_parts.append(" | ".join(example_texts))
        
        text = normalize(" | ".join(text_parts))
        
        items.append({
            "id": r.get("id"),
            "sense": r.get("sense", ""),
            "headword": head,
            "meaning": meaning,
            "partOfSpeech": r.get("partOfSpeech", ""),
            "examples": r.get("examples", []),
            "text": text
        })
    
    return items

def build_index(items, model_name, out_path):
    """Build ChromaDB index"""
    client = chromadb.PersistentClient(path=out_path)
    collection = client.get_or_create_collection(
        name="dictionary",
        metadata={"model_name": model_name}
    )
    
    print(f"Loading model {model_name}...")
    model = SentenceTransformer(model_name)
    
    texts = [it["text"] for it in items]
    print(f"Generating embeddings for {len(texts)} entries...")
    # Use smaller batch size for better CPU utilization and memory efficiency
    # CPU processing works better with smaller batches (128-256)
    embeddings = model.encode(
        texts, 
        normalize_embeddings=True,
        show_progress_bar=True,
        batch_size=256,  # Smaller batch size for better CPU parallelization
        convert_to_numpy=True,
        device='cpu'  # Explicitly use CPU
    )
    embeddings = embeddings.tolist()
    
    metadatas = []
    for it in items:
        metadata = {
            "sense": it.get("sense", ""),
            "headword": it.get("headword", ""),
            "meaning": it.get("meaning", ""),
            "partOfSpeech": it.get("partOfSpeech", ""),
            "examples": json.dumps(it.get("examples", []))
        }
        metadatas.append(metadata)
    
    batch_size = 5000
    total_items = len(items)
    
    print(f"Adding {total_items} entries to ChromaDB...")
    for i in range(0, total_items, batch_size):
        batch_end = min(i + batch_size, total_items)
        collection.add(
            ids=[it["id"] for it in items[i:batch_end]],
            embeddings=embeddings[i:batch_end],
            documents=texts[i:batch_end],
            metadatas=metadatas[i:batch_end]
        )
        print(f"  Processed {batch_end}/{total_items} entries", end='\r')
    
    print(f"\nDone! Indexed {total_items} entries → {out_path}")

if __name__ == "__main__":
    if not os.path.exists(DATA_PATH):
        print(f"Error: Data file not found at {DATA_PATH}")
        sys.exit(1)
    
    print(f"Loading data from {DATA_PATH}...")
    items = load_data(DATA_PATH)
    print(f"Loaded {len(items)} entries")
    
    print("Building ChromaDB index...")
    build_index(items, MODEL_NAME, CHROMA_DB_PATH)
    print("Build complete!")

