package http

import (
	"chaatra/core"
	"chaatra/persistence"
	"chaatra/service"
	"encoding/json"
	"log"
	"net/http"
)

func SearchHandler(w http.ResponseWriter, r *http.Request) {
	slp1Query := r.URL.Query().Get("slp1")
	if slp1Query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	log.Println("SLP1 query : ", slp1Query)

	var letters []*core.Letter
	for _, c := range slp1Query {
		l := core.TheAlphabet[string(c)]

		letters = append(letters, &l)
	}

	words := core.T.GetWordsForPrefixFuzzy(letters)
	entries := make([]*core.Entry, 0)

	for _, res := range words {
		devanagariWord := core.StringifyTokens(res)

		if e, ok := core.D[devanagariWord]; ok {
			entries = append(entries, e)
		}
	}

	devanagariQuery := r.URL.Query().Get("dev")
	if devanagariQuery != "" {
		log.Println("SLP1 query : ", devanagariQuery)
		esEntries, _ := persistence.SearchDictionaryEntry(devanagariQuery)
		entries = append(entries, esEntries...)
	}

	// Set the content type to application/json
	w.Header().Set("Content-Type", "application/json")

	// Encode results to JSON and write the response
	json.NewEncoder(w).Encode(entries)
}

func AutoCompleteHandler(w http.ResponseWriter, r *http.Request) {
	slp1Query := r.URL.Query().Get("slp1")
	if slp1Query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	log.Println("SLP1 query : ", slp1Query)

	results := service.AutoComplete(service.LookupReq{
		Slp1: slp1Query,
	})

	// Set the content type to application/json
	w.Header().Set("Content-Type", "application/json")

	// Encode results to JSON and write the response
	json.NewEncoder(w).Encode(results)
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
