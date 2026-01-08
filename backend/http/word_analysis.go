package http

import (
	"chaatra/service"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// WordAnalysisRequest represents the request body for word analysis
type WordAnalysisRequest struct {
	Word string `json:"word"`
}

// WordAnalysisHandler handles word analysis requests
func WordAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req WordAnalysisRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Word == "" {
		http.Error(w, "Word is required", http.StatusBadRequest)
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Analyze the word
	analysis, err := service.AnalyzeWord(ctx, req.Word)
	if err != nil {
		log.Printf("Error analyzing word '%s': %v", req.Word, err)
		http.Error(w, fmt.Sprintf("Failed to analyze word: %v", err), http.StatusInternalServerError)
		return
	}

	// Return JSON response
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(analysis); err != nil {
		log.Printf("Error encoding response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

