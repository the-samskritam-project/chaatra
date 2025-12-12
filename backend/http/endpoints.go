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
	"os"
	"strconv"
	"strings"
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

// RamayanaSummarizeHandler generates a summary using OpenAI based on context
func RamayanaSummarizeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req service.RamayanaSummarizeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Kanda == "" || req.Sarga == 0 || req.Shloka == 0 {
		http.Error(w, "kanda, sarga, and shloka are required", http.StatusBadRequest)
		return
	}

	window := req.Window
	if window <= 0 || window > 20 {
		window = 10
	}

	context, err := persistence.GetRamayanaContext(req.Kanda, req.Sarga, req.Shloka, window)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to load context: %v", err), http.StatusBadRequest)
		return
	}

	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		http.Error(w, "OpenAI API key not configured", http.StatusFailedDependency)
		return
	}

	summary, err := service.CallOpenAISummary(apiKey, req, context)
	if err != nil {
		http.Error(w, fmt.Sprintf("Summary request failed: %v", err), http.StatusBadGateway)
		return
	}

	resp := map[string]any{
		"summary": summary,
		"context": context,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func RamayanaExploreHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	score := 0.5
	if raw := r.URL.Query().Get("score"); raw != "" {
		val, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			http.Error(w, "score must be a number between 0 and 1", http.StatusBadRequest)
			return
		}
		if val < 0 || val > 1 {
			http.Error(w, "score must be between 0 and 1", http.StatusBadRequest)
			return
		}
		score = val
	}

	shloka, err := service.GetRandomShlokaByComplexity(score)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	resp := map[string]any{
		"requested_score": score,
		"matched_score":   shloka.Metrics.ComplexityScore,
		"shloka":          shloka,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, fmt.Sprintf("failed to encode response: %v", err), http.StatusInternalServerError)
		return
	}
}

// HitopadesaChaptersHandler returns all chapter metadata
func HitopadesaChaptersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	chapters, err := service.GetHitopadesaChapters()
	if err != nil {
		log.Printf("Error getting Hitopadesa chapters: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get chapters: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chapters)
}

// HitopadesaVersesHandler returns verses for a given chapter
func HitopadesaVersesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	chapterStr := r.URL.Query().Get("chapter")
	if chapterStr == "" {
		http.Error(w, "chapter parameter is required", http.StatusBadRequest)
		return
	}

	chapterNumber, err := strconv.Atoi(chapterStr)
	if err != nil {
		http.Error(w, "chapter must be a valid number", http.StatusBadRequest)
		return
	}

	verses, err := service.GetHitopadesaVerses(chapterNumber)
	if err != nil {
		log.Printf("Error getting Hitopadesa verses for chapter %d: %v", chapterNumber, err)
		http.Error(w, fmt.Sprintf("Failed to get verses: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(verses)
}

// HitopadesaUpdateVerseHandler handles updating a verse's translation
func HitopadesaUpdateVerseHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract verse number from URL path
	// Expected format: /v2/hitopadesa/verses/{verse_number}
	path := strings.TrimPrefix(r.URL.Path, "/v2/hitopadesa/verses/")
	verseNumber := strings.TrimSpace(path)

	if verseNumber == "" {
		http.Error(w, "verse number is required in URL path", http.StatusBadRequest)
		return
	}

	// Parse request body
	var requestBody struct {
		EditedTranslation string `json:"edited_translation"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if requestBody.EditedTranslation == "" {
		http.Error(w, "edited_translation is required", http.StatusBadRequest)
		return
	}

	// Call service layer
	err := service.UpdateHitopadesaVerseTranslation(verseNumber, requestBody.EditedTranslation)
	if err != nil {
		log.Printf("Error updating Hitopadesa verse %s: %v", verseNumber, err)
		http.Error(w, fmt.Sprintf("Failed to update verse: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Translation updated successfully",
	})
}

// PancatantraChaptersHandler returns all chapter metadata
func PancatantraChaptersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	chapters, err := service.GetPancatantraChapters()
	if err != nil {
		log.Printf("Error getting Pancatantra chapters: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get chapters: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chapters)
}

// PancatantraVersesHandler returns verses for a given chapter
func PancatantraVersesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	chapterStr := r.URL.Query().Get("chapter")
	if chapterStr == "" {
		http.Error(w, "chapter parameter is required", http.StatusBadRequest)
		return
	}

	chapterNumber, err := strconv.Atoi(chapterStr)
	if err != nil {
		http.Error(w, "chapter must be a valid number", http.StatusBadRequest)
		return
	}

	verses, err := service.GetPancatantraVerses(chapterNumber)
	if err != nil {
		log.Printf("Error getting Pancatantra verses for chapter %d: %v", chapterNumber, err)
		http.Error(w, fmt.Sprintf("Failed to get verses: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(verses)
}

// PancatantraUpdateVerseHandler handles updating a verse's translation
func PancatantraUpdateVerseHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract verse number from URL path
	// Expected format: /v2/pancatantra/verses/{verse_number}
	path := strings.TrimPrefix(r.URL.Path, "/v2/pancatantra/verses/")
	verseNumber := strings.TrimSpace(path)

	if verseNumber == "" {
		http.Error(w, "verse number is required in URL path", http.StatusBadRequest)
		return
	}

	// Parse request body
	var requestBody struct {
		EditedTranslation string `json:"edited_translation"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if requestBody.EditedTranslation == "" {
		http.Error(w, "edited_translation is required", http.StatusBadRequest)
		return
	}

	// Call service layer
	err := service.UpdatePancatantraVerseTranslation(verseNumber, requestBody.EditedTranslation)
	if err != nil {
		log.Printf("Error updating Pancatantra verse %s: %v", verseNumber, err)
		http.Error(w, fmt.Sprintf("Failed to update verse: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Translation updated successfully",
	})
}

// SemanticSearchHandler handles semantic search requests
// Note: This endpoint requires query embedding to be generated externally
// For a complete implementation, you would call the Python vector_search module
// via a service bridge or implement embedding generation in Go
func SemanticSearchHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var query string
	var corpusFilter string
	var limit int = 10

	if r.Method == http.MethodGet {
		query = r.URL.Query().Get("q")
		corpusFilter = r.URL.Query().Get("corpus")
		if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
			if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
				limit = parsedLimit
			}
		}
	} else {
		// POST request with JSON body
		var requestBody struct {
			Query        string `json:"query"`
			CorpusFilter string `json:"corpus_filter,omitempty"`
			Limit        int    `json:"limit,omitempty"`
		}

		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
			return
		}

		query = requestBody.Query
		corpusFilter = requestBody.CorpusFilter
		if requestBody.Limit > 0 {
			limit = requestBody.Limit
		}
	}

	if query == "" {
		http.Error(w, "query parameter is required (use ?q=your_query for GET or {\"query\": \"your_query\"} for POST)", http.StatusBadRequest)
		return
	}

	// For now, return an error indicating that embedding generation is required
	// In a full implementation, you would:
	// 1. Call a Python service to generate the query embedding
	// 2. Or use a Go embedding library
	// 3. Then call the vector search function
	http.Error(w, "Semantic search requires query embedding generation. Please use the Python vector_search module or implement embedding generation in Go.", http.StatusNotImplemented)

	// TODO: Implement full semantic search with embedding generation
	// Example implementation:
	// 1. Generate query embedding (via Python service or Go library)
	// 2. Call service.PerformSemanticSearch(queryEmbedding, corpusFilter, limit)
	// 3. Return results
}
