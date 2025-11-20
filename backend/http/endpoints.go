package http

import (
	"chaatra/core/parser"
	"chaatra/core/trans"
	"chaatra/persistence"
	"chaatra/service"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
)

var Dictionary map[string]*parser.DictionaryEntry
var Trie *trans.Trie

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

func AutoCompleteHandler(w http.ResponseWriter, r *http.Request) {
	slp1Query := r.URL.Query().Get("slp1")
	if slp1Query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	log.Println("SLP1 query : ", slp1Query)

	results := service.AutoComplete(Trie, slp1Query)

	// Set the content type to application/json
	w.Header().Set("Content-Type", "application/json")

	// Encode results to JSON and write the response
	json.NewEncoder(w).Encode(results)
}

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

	// Set the content type to application/json
	w.Header().Set("Content-Type", "application/json")

	// Encode results to JSON and write the response
	json.NewEncoder(w).Encode(results)
}

// SearchChromaHandler handles semantic search using ChromaDB
func SearchChromaHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required (use ?q=your_query)", http.StatusBadRequest)
		return
	}

	nResults := 5
	if n := r.URL.Query().Get("n"); n != "" {
		fmt.Sscanf(n, "%d", &nResults)
		if nResults < 1 || nResults > 50 {
			nResults = 5
		}
	}

	entries, err := persistence.SearchChromaDB(query, nResults, persistence.ChromaIndexEnglish)
	if err != nil {
		log.Printf("ChromaDB search error: %v", err)
		http.Error(w, fmt.Sprintf("Search error: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// SearchV2EnglishHandler handles semantic search for English queries
func SearchV2EnglishHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required (use ?q=your_query)", http.StatusBadRequest)
		return
	}

	nResults := 5
	if n := r.URL.Query().Get("n"); n != "" {
		fmt.Sscanf(n, "%d", &nResults)
		if nResults < 1 || nResults > 50 {
			nResults = 5
		}
	}

	entries, err := persistence.SearchChromaDB(query, nResults, persistence.ChromaIndexEnglish)
	if err != nil {
		log.Printf("ChromaDB search error: %v", err)
		http.Error(w, fmt.Sprintf("Search error: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// SearchV2SanskritHandler handles semantic search for Sanskrit queries (SLP1 format)
func SearchV2SanskritHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required (use ?q=your_query)", http.StatusBadRequest)
		return
	}

	nResults := 10

	devanagari := trans.Trans(query)

	log.Println("Devanagari query : ", devanagari)

	entries, err := persistence.SearchChromaDB(devanagari, nResults, persistence.ChromaIndexSanskrit)
	if err != nil {
		log.Printf("ChromaDB search error: %v", err)
		http.Error(w, fmt.Sprintf("Search error: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	for _, entry := range entries {
		log.Println("Search Term : ", devanagari, " Entry : ", entry.DevanagariWord)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// SearchRamayanaHandler handles Ramayana semantic search (English queries)
func SearchRamayanaHandler(w http.ResponseWriter, r *http.Request) {
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

	entries, err := persistence.SearchChromaDB(query, nResults, persistence.ChromaIndexRamayana)
	if err != nil {
		log.Printf("ChromaDB Ramayana search error: %v", err)
		http.Error(w, fmt.Sprintf("Search error: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// RamayanaContextHandler returns a window of Ramayana shlokas around a target verse
func RamayanaContextHandler(w http.ResponseWriter, r *http.Request) {
	kanda := r.URL.Query().Get("kanda")
	sargaStr := r.URL.Query().Get("sarga")
	shlokaStr := r.URL.Query().Get("shloka")
	if kanda == "" || sargaStr == "" || shlokaStr == "" {
		http.Error(w, "kanda, sarga, and shloka are required", http.StatusBadRequest)
		return
	}

	sarga, err := strconv.Atoi(sargaStr)
	if err != nil {
		http.Error(w, "invalid sarga value", http.StatusBadRequest)
		return
	}
	shloka, err := strconv.Atoi(shlokaStr)
	if err != nil {
		http.Error(w, "invalid shloka value", http.StatusBadRequest)
		return
	}

	window := 10
	if winStr := r.URL.Query().Get("window"); winStr != "" {
		if val, err := strconv.Atoi(winStr); err == nil && val >= 0 && val <= 50 {
			window = val
		}
	}

	contextEntries, err := persistence.GetRamayanaContext(kanda, sarga, shloka, window)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"kanda":   kanda,
		"sarga":   sarga,
		"shloka":  shloka,
		"window":  window,
		"entries": contextEntries,
	})
}
