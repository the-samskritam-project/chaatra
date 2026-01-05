package http

import (
	"chaatra/core/parser"
	"chaatra/persistence"
	"chaatra/service"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

// SearchHandler handles dictionary search queries
func SearchHandler(w http.ResponseWriter, r *http.Request) {
	slp1Query := r.URL.Query().Get("slp1")
	if slp1Query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	entries := make([]*parser.DictionaryEntry, 0)
	matches := service.LookupPrefixes(Trie, slp1Query)

	for _, match := range matches {
		entry := Dictionary[match.LatinSLP1()]
		if entry != nil {
			entries = append(entries, entry)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// AutoCompleteHandler handles autocomplete queries
func AutoCompleteHandler(w http.ResponseWriter, r *http.Request) {
	slp1Query := r.URL.Query().Get("slp1")
	if slp1Query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	results := service.AutoComplete(Trie, slp1Query)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// TransliterateHandler handles transliteration requests
func TransliterateHandler(w http.ResponseWriter, r *http.Request) {
	slp1Query := r.URL.Query().Get("slp1")
	if slp1Query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	result := service.Transliterate(slp1Query)

	json.NewEncoder(w).Encode(map[string]string{"slp1": slp1Query, "devanagari": result})
	w.Header().Set("Content-Type", "application/json")
}

// SearchDhatuHandler handles dhatu search queries
func SearchDhatuHandler(w http.ResponseWriter, r *http.Request) {
	englishWord := r.URL.Query().Get("englishWord")
	if englishWord == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	results, err := persistence.SearchDhatu(englishWord)
	if err != nil {
		w.Write([]byte(err.Error()))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// SearchV2EnglishHandler handles semantic search for English queries
func SearchV2EnglishHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required (use ?q=your_query)", http.StatusBadRequest)
		return
	}

	nResults := 20
	if n := r.URL.Query().Get("n"); n != "" {
		fmt.Sscanf(n, "%d", &nResults)
		if nResults < 1 || nResults > 50 {
			nResults = 20
		}
	}

	// Generate embedding for the query with 384 dimensions (matching stored embeddings)
	log.Printf("SearchV2EnglishHandler: generating embedding for query: %q", query)
	queryEmbedding, err := generateEmbedding(query, 384)
	if err != nil {
		log.Printf("ERROR: Failed to generate embedding: %v", err)
		http.Error(w, fmt.Sprintf("Failed to generate embedding: %v", err), http.StatusInternalServerError)
		return
	}
	log.Printf("Generated embedding with length: %d", len(queryEmbedding))

	// Perform vector search on Apte dictionary
	entries, err := persistence.SearchApteDictionary(queryEmbedding, nResults)
	if err != nil {
		log.Printf("ERROR: Vector search failed: %v", err)
		http.Error(w, fmt.Sprintf("Search error: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	log.Printf("SearchV2EnglishHandler: returning %d results", len(entries))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}
