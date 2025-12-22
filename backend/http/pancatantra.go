package http

import (
	"chaatra/service"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
)

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
