package http

import (
	"chaatra/persistence"
	"chaatra/service"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
)

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

// RamayanaExploreHandler returns a random shloka based on complexity score
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
