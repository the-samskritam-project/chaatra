package http

import (
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
