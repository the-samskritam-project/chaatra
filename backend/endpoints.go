package main

import (
	"encoding/json"
	"log"
	"net/http"
)

func searchHandler(w http.ResponseWriter, r *http.Request) {
	slp1Query := r.URL.Query().Get("slp1")
	if slp1Query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	log.Println("SLP1 query : ", slp1Query)

	var letters []*letter
	for _, c := range slp1Query {
		l := theAlphabet[string(c)]

		letters = append(letters, &l)
	}

	words := t.getWordsForPrefixFuzzy(letters)
	entries := make([]*Entry, 0)

	for _, res := range words {
		devanagariWord := stringifyTokens(res)

		if e, ok := (*d)[devanagariWord]; ok {
			entries = append(entries, e)
		}
	}

	devanagariQuery := r.URL.Query().Get("dev")
	if devanagariQuery != "" {
		log.Println("SLP1 query : ", devanagariQuery)
		esEntries, _ := searchEntry(devanagariQuery)
		entries = append(entries, esEntries...)
	}

	// Set the content type to application/json
	w.Header().Set("Content-Type", "application/json")

	// Encode results to JSON and write the response
	json.NewEncoder(w).Encode(entries)
}

func autoCompleteHandler(w http.ResponseWriter, r *http.Request) {
	slp1Query := r.URL.Query().Get("slp1")
	if slp1Query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	log.Println("SLP1 query : ", slp1Query)

	var letters []*letter
	for _, c := range slp1Query {
		l := theAlphabet[string(c)]

		letters = append(letters, &l)
	}

	var words [][]*letter
	mode := r.URL.Query().Get("mode")
	if mode != "" && mode == "strict" {
		words = t.getWordsForPrefixStrict(letters)
	} else {
		words = t.getWordsForPrefixFuzzy(letters)
	}

	entries := make([]*Entry, 0)

	for _, res := range words {
		devanagariWord := stringifyTokens(res)

		if e, ok := (*d)[devanagariWord]; ok {
			entries = append(entries, e)
		}
	}

	devanagariQuery := r.URL.Query().Get("dev")
	if devanagariQuery != "" {
		log.Println("SLP1 query : ", devanagariQuery)
		esEntries, _ := searchEntry(devanagariQuery)
		entries = append(entries, esEntries...)
	}

	// Set the content type to application/json
	w.Header().Set("Content-Type", "application/json")

	// Encode results to JSON and write the response
	json.NewEncoder(w).Encode(entries)
}
