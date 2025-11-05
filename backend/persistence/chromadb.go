package persistence

import (
	"bytes"
	"chaatra/core/parser"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

var chromaClient *http.Client
var chromaBaseURL string

// ChromaDBResponse represents the response structure from ChromaDB
type ChromaDBResponse struct {
	Ids       [][]string                 `json:"ids"`
	Documents [][]string                 `json:"documents"`
	Metadatas [][]map[string]interface{} `json:"metadatas"`
	Distances [][]float64                `json:"distances"`
}

// ChromaQueryRequest represents a query request to ChromaDB
type ChromaQueryRequest struct {
	QueryTexts      []string               `json:"query_texts,omitempty"`
	QueryEmbeddings [][]float32            `json:"query_embeddings,omitempty"`
	NResults        int                    `json:"n_results"`
	Where           map[string]interface{} `json:"where,omitempty"`
	Include         []string               `json:"include"`
}

// InitChroma initializes the ChromaDB client
// If chromaURL is empty, defaults to http://localhost:8000
func InitChroma(chromaURL string) {
	if chromaURL == "" {
		chromaURL = "http://localhost:8000"
	}
	chromaBaseURL = chromaURL
	chromaClient = &http.Client{
		Timeout: 30 * time.Second,
	}
	log.Printf("ChromaDB client initialized: %s", chromaBaseURL)
}

// SearchChromaDB searches ChromaDB using text query via Python bridge service
// The bridge service generates embeddings and queries ChromaDB
func SearchChromaDB(queryText string, nResults int) ([]*parser.Entry, error) {
	if chromaClient == nil {
		return nil, fmt.Errorf("ChromaDB client not initialized. Call InitChroma() first")
	}

	// Query the Python bridge service (usually on port 8001)
	bridgeURL := os.Getenv("CHROMA_BRIDGE_URL")
	if bridgeURL == "" {
		bridgeURL = "http://localhost:8001"
	}

	queryReq := map[string]interface{}{
		"query":     queryText,
		"n_results": nResults,
	}

	jsonData, err := json.Marshal(queryReq)
	if err != nil {
		return nil, fmt.Errorf("error marshaling query request: %w", err)
	}

	url := fmt.Sprintf("%s/query", bridgeURL)
	req, err := http.NewRequestWithContext(context.Background(), "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := chromaClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ChromaDB bridge error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var bridgeResp struct {
		Results []struct {
			ID       string                 `json:"id"`
			Metadata map[string]interface{} `json:"metadata"`
			Document string                 `json:"document"`
			Score    float64                `json:"score"`
		} `json:"results"`
		Error string `json:"error,omitempty"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&bridgeResp); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	if bridgeResp.Error != "" {
		return nil, fmt.Errorf("bridge service error: %s", bridgeResp.Error)
	}

	// Convert bridge response to parser.Entry format
	entries := make([]*parser.Entry, 0)
	for _, result := range bridgeResp.Results {
		metadata := result.Metadata

		headword := ""
		meaning := ""
		if hw, ok := metadata["headword"].(string); ok {
			headword = hw
		}
		if m, ok := metadata["meaning"].(string); ok {
			meaning = m
		}

		entries = append(entries, &parser.Entry{
			DevanagariWord:     result.Document,
			TransliteratedWord: headword,
			EnglishMeaning:     meaning,
			Metadata:           metadata,
		})
	}

	return entries, nil
}

// convertChromaResponseToEntries converts ChromaDB response to parser.Entry format
func convertChromaResponseToEntries(chromaResp ChromaDBResponse) ([]*parser.Entry, error) {
	entries := make([]*parser.Entry, 0)
	if len(chromaResp.Ids) > 0 && len(chromaResp.Ids[0]) > 0 {
		for i := range chromaResp.Ids[0] {
			metadata := chromaResp.Metadatas[0][i]

			// Extract fields from metadata
			headword := ""
			meaning := ""
			if hw, ok := metadata["headword"].(string); ok {
				headword = hw
			}
			if m, ok := metadata["meaning"].(string); ok {
				meaning = m
			}

			// Try to get Devanagari from document or transliterate headword
			devanagariWord := ""
			if len(chromaResp.Documents) > 0 && len(chromaResp.Documents[0]) > i {
				// Document might contain Devanagari text
				doc := chromaResp.Documents[0][i]
				// Simple extraction - adjust based on your document format
				devanagariWord = doc
			}

			entries = append(entries, &parser.Entry{
				DevanagariWord:     devanagariWord,
				TransliteratedWord: headword,
				EnglishMeaning:     meaning,
				Metadata:           metadata,
			})
		}
	}

	return entries, nil
}

// SearchChromaDBWithEmbedding searches ChromaDB using pre-computed embeddings
// This is useful if you want to generate embeddings in Go
func SearchChromaDBWithEmbedding(queryEmbedding []float32, nResults int) ([]*parser.Entry, error) {
	if chromaClient == nil {
		return nil, fmt.Errorf("ChromaDB client not initialized. Call InitChroma() first")
	}

	queryReq := ChromaQueryRequest{
		QueryEmbeddings: [][]float32{queryEmbedding},
		NResults:        nResults,
		Include:         []string{"documents", "metadatas", "distances"},
	}

	jsonData, err := json.Marshal(queryReq)
	if err != nil {
		return nil, fmt.Errorf("error marshaling query request: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/collections/dictionary/query", chromaBaseURL)
	req, err := http.NewRequestWithContext(context.Background(), "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := chromaClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ChromaDB API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var chromaResp ChromaDBResponse
	if err := json.NewDecoder(resp.Body).Decode(&chromaResp); err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	return convertChromaResponseToEntries(chromaResp)
}
