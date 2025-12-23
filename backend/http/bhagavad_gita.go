package http

import (
	"chaatra/persistence"
	"chaatra/service"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
)

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
// Also handles split requests (POST to /verses/{id}/split) and translate requests (POST to /verses/{id}/translate)
func BhagavadGitaUpdateVerseHandler(w http.ResponseWriter, r *http.Request) {
	// Handle OPTIONS for CORS preflight
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Check if this is a translate request (POST to path ending with /translate)
	if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/translate") {
		BhagavadGitaTranslateVerseHandler(w, r)
		return
	}

	// Check if this is a split request (POST to path ending with /split)
	isSplitRequest := r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/split")

	if isSplitRequest {
		log.Printf("Routing to split handler: method=%s, path=%s", r.Method, r.URL.Path)
		BhagavadGitaSplitVerseHandler(w, r)
		return
	}

	// Only allow PUT for update requests
	if r.Method != http.MethodPut {
		log.Printf("Method not allowed in update handler: method=%s, path=%s, isSplitRequest=%v", r.Method, r.URL.Path, isSplitRequest)
		http.Error(w, fmt.Sprintf("Method not allowed. Expected PUT for updates or POST to /split for splitting. Got: %s", r.Method), http.StatusMethodNotAllowed)
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

// BhagavadGitaSplitVerseHandler handles splitting sandhis in a verse
func BhagavadGitaSplitVerseHandler(w http.ResponseWriter, r *http.Request) {
	// Extract verse number or ID from URL path
	// Expected format: /v2/bhagavad_gita/verses/{verse_number_or_id}/split
	path := strings.TrimPrefix(r.URL.Path, "/v2/bhagavad_gita/verses/")
	path = strings.TrimSuffix(path, "/split")
	verseNumber := strings.TrimSpace(path)

	if verseNumber == "" {
		http.Error(w, "verse number or ID is required in URL path", http.StatusBadRequest)
		return
	}

	// Parse verse number to get chapter number
	var chapterNumber int
	_, err := fmt.Sscanf(verseNumber, "%d.", &chapterNumber)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid verse number format: %v", err), http.StatusBadRequest)
		return
	}

	// Fetch the verse from MongoDB to get Devanagari text
	verses, err := service.GetBhagavadGitaVerses(chapterNumber)
	if err != nil {
		log.Printf("Error fetching verses for chapter %d: %v", chapterNumber, err)
		http.Error(w, fmt.Sprintf("Failed to fetch verse: %v", err), http.StatusInternalServerError)
		return
	}

	// Find the verse by verse_number
	var verse *persistence.HitopadesaVerse
	for i := range verses {
		if verses[i].VerseNumber == verseNumber {
			verse = &verses[i]
			break
		}
	}

	if verse == nil {
		http.Error(w, fmt.Sprintf("Verse not found: %s", verseNumber), http.StatusNotFound)
		return
	}

	if verse.TransliteratedDevanagari == "" {
		http.Error(w, "Verse has no Devanagari text", http.StatusBadRequest)
		return
	}

	// Call service layer to perform split
	ctx := r.Context()
	splitResult, err := service.SplitBhagavadGitaVerse(ctx, verseNumber, verse.TransliteratedDevanagari)
	if err != nil {
		log.Printf("Error splitting verse %s: %v", verseNumber, err)
		http.Error(w, fmt.Sprintf("Failed to split verse: %v", err), http.StatusInternalServerError)
		return
	}

	// Return the split results
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":                   "success",
		"uncompounded_shloka":      splitResult.UncompoundedShloka,
		"word_by_word_translation": splitResult.WordByWordTranslation,
	})
}

// BhagavadGitaTranslateVerseHandler handles generating AI translation for a verse
func BhagavadGitaTranslateVerseHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract verse number or ID from URL path
	// Expected format: /v2/bhagavad_gita/verses/{verse_number_or_id}/translate
	path := strings.TrimPrefix(r.URL.Path, "/v2/bhagavad_gita/verses/")
	path = strings.TrimSuffix(path, "/translate")
	verseNumber := strings.TrimSpace(path)

	if verseNumber == "" {
		http.Error(w, "verse number or ID is required in URL path", http.StatusBadRequest)
		return
	}

	// Parse verse number to get chapter number
	var chapterNumber int
	_, err := fmt.Sscanf(verseNumber, "%d.", &chapterNumber)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid verse number format: %v", err), http.StatusBadRequest)
		return
	}

	// Fetch the verse from MongoDB to get Devanagari text
	verses, err := service.GetBhagavadGitaVerses(chapterNumber)
	if err != nil {
		log.Printf("Error fetching verses for chapter %d: %v", chapterNumber, err)
		http.Error(w, fmt.Sprintf("Failed to fetch verse: %v", err), http.StatusInternalServerError)
		return
	}

	// Find the verse by verse_number
	var verse *persistence.HitopadesaVerse
	for i := range verses {
		if verses[i].VerseNumber == verseNumber {
			verse = &verses[i]
			break
		}
	}

	if verse == nil {
		http.Error(w, fmt.Sprintf("Verse not found: %s", verseNumber), http.StatusNotFound)
		return
	}

	if verse.TransliteratedDevanagari == "" {
		http.Error(w, "Verse has no Devanagari text", http.StatusBadRequest)
		return
	}

	// Call service layer to generate translation
	ctx := r.Context()
	translation, err := service.GenerateBhagavadGitaVerseTranslation(ctx, verseNumber, verse.TransliteratedDevanagari)
	if err != nil {
		log.Printf("Error translating verse %s: %v", verseNumber, err)
		http.Error(w, fmt.Sprintf("Failed to translate verse: %v", err), http.StatusInternalServerError)
		return
	}

	// Return the translation
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "success",
		"translation": translation,
	})
}

// BhagavadGitaSemanticSearchHandler handles semantic search requests for Bhagavad Gita
func BhagavadGitaSemanticSearchHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var query string
	var limit int = 10

	if r.Method == http.MethodGet {
		query = r.URL.Query().Get("q")
		if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
			if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
				limit = parsedLimit
			}
		}
	} else {
		// POST request with JSON body
		var requestBody struct {
			Query string `json:"query"`
			Limit int    `json:"limit,omitempty"`
		}

		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
			return
		}

		query = requestBody.Query
		if requestBody.Limit > 0 {
			limit = requestBody.Limit
		}
	}

	if query == "" {
		http.Error(w, "query parameter is required (use ?q=your_query for GET or {\"query\": \"your_query\"} for POST)", http.StatusBadRequest)
		return
	}

	log.Printf("BhagavadGitaSemanticSearchHandler: query=%q, limit=%d", query, limit)

	// Generate embedding for the query (using function from semantic_search.go in same package)
	log.Printf("Generating embedding for query: %q", query)
	queryEmbedding, err := generateEmbedding(query)
	if err != nil {
		log.Printf("ERROR: Failed to generate embedding: %v", err)
		http.Error(w, fmt.Sprintf("Failed to generate embedding: %v", err), http.StatusInternalServerError)
		return
	}
	log.Printf("Generated embedding with length: %d", len(queryEmbedding))

	// Perform semantic search with hardcoded corpusFilter="bhagavad_gita"
	log.Printf("Calling PerformSemanticSearch with corpusFilter=bhagavad_gita, limit=%d", limit)
	results, err := service.PerformSemanticSearch(queryEmbedding, "bhagavad_gita", limit)
	if err != nil {
		log.Printf("ERROR: Semantic search failed: %v", err)
		http.Error(w, fmt.Sprintf("Search failed: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("BhagavadGitaSemanticSearchHandler: returning %d results", len(results))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
