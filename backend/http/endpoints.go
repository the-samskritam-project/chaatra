package http

import (
	"chaatra/core/parser"
	"chaatra/core/trans"
	"chaatra/persistence"
	"chaatra/service"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
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

// PancatantraWordCloudHandler returns word cloud data
func PancatantraWordCloudHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	wordCloudData, err := service.GetPancatantraWordCloudData()
	if err != nil {
		log.Printf("Error getting Pancatantra word cloud data: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get word cloud data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wordCloudData)
}

// PancatantraVerseContextHandler returns interval and verse context for a given verse
func PancatantraVerseContextHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	verseNumber := r.URL.Query().Get("verse_number")
	if verseNumber == "" {
		http.Error(w, "verse_number parameter is required", http.StatusBadRequest)
		return
	}

	// Get type parameter (optional, defaults to "verse" for backward compatibility)
	itemType := r.URL.Query().Get("type")
	if itemType == "" {
		itemType = "verse"
	}

	context, err := service.GetPancatantraVerseContext(verseNumber, itemType)
	if err != nil {
		log.Printf("Error getting Pancatantra verse context for %s (type: %s): %v", verseNumber, itemType, err)
		http.Error(w, fmt.Sprintf("Failed to get verse context: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(context)
}

// BhagavadGitaChaptersHandler returns all chapter metadata
func BhagavadGitaChaptersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	chapters, err := service.GetBhagavadGitaChapters()
	if err != nil {
		log.Printf("Error getting Bhagavad Gita chapters: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get chapters: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chapters)
}

// BhagavadGitaVersesHandler returns verses and commentary for a given chapter
func BhagavadGitaVersesHandler(w http.ResponseWriter, r *http.Request) {
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

	verses, err := service.GetBhagavadGitaVerses(chapterNumber)
	if err != nil {
		log.Printf("Error getting Bhagavad Gita verses for chapter %d: %v", chapterNumber, err)
		http.Error(w, fmt.Sprintf("Failed to get verses: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(verses)
}

// BhagavadGitaUpdateVerseHandler handles updating a verse's or commentary's translation
func BhagavadGitaUpdateVerseHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract verse number or ID from URL path
	// Expected format: /v2/bhagavad_gita/verses/{verse_number_or_id}
	path := strings.TrimPrefix(r.URL.Path, "/v2/bhagavad_gita/verses/")
	verseNumber := strings.TrimSpace(path)

	if verseNumber == "" {
		http.Error(w, "verse number or ID is required in URL path", http.StatusBadRequest)
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
	err := service.UpdateBhagavadGitaVerseTranslation(verseNumber, requestBody.EditedTranslation)
	if err != nil {
		log.Printf("Error updating Bhagavad Gita verse/commentary %s: %v", verseNumber, err)
		http.Error(w, fmt.Sprintf("Failed to update translation: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Translation updated successfully",
	})
}

// generateEmbedding generates an embedding vector for text using OpenAI API
func generateEmbedding(text string) ([]float64, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}

	// Prepare request to OpenAI embeddings API
	requestBody := map[string]interface{}{
		"input": text,
		"model": "text-embedding-3-small",
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/embeddings", strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call OpenAI API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		Data []struct {
			Embedding []float64 `json:"embedding"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(result.Data) == 0 {
		return nil, fmt.Errorf("no embedding data in response")
	}

	return result.Data[0].Embedding, nil
}

// SemanticSearchHandler handles semantic search requests
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

	// Generate embedding for the query
	queryEmbedding, err := generateEmbedding(query)
	if err != nil {
		log.Printf("Failed to generate embedding: %v", err)
		http.Error(w, fmt.Sprintf("Failed to generate embedding: %v", err), http.StatusInternalServerError)
		return
	}

	// Perform semantic search
	results, err := service.PerformSemanticSearch(queryEmbedding, corpusFilter, limit)
	if err != nil {
		log.Printf("Semantic search failed: %v", err)
		http.Error(w, fmt.Sprintf("Search failed: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
