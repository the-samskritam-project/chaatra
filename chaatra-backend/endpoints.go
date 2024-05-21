package main

import (
	"encoding/json"
	"log"
	"net/http"
)

func searchHandler(w http.ResponseWriter, r *http.Request) {
	// Parse the query parameter "search" from the URL
	searchQuery := r.URL.Query().Get("slp1")
	if searchQuery == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	log.Println("Search query is ...", searchQuery)

	var letters []*letter
	for _, c := range searchQuery {
		l := theAlphabet[string(c)]

		letters = append(letters, &l)
	}

	words := t.getWordsForPrefix(letters)
	entries := make([]*Entry, 0)

	for _, res := range words {
		devanagariWord := stringifyTokens(res)

		if e, ok := (*d)[devanagariWord]; ok {
			entries = append(entries, e)
		}
	}

	//entries, _ := searchEntry(searchQuery)

	// Set the content type to application/json
	w.Header().Set("Content-Type", "application/json")

	// Encode results to JSON and write the response
	json.NewEncoder(w).Encode(entries)
}
