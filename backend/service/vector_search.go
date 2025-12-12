package service

import (
	"chaatra/persistence"
	"fmt"
)

// SemanticSearchRequest represents a semantic search request
type SemanticSearchRequest struct {
	Query        string `json:"query"`
	CorpusFilter string `json:"corpus_filter,omitempty"`
	Limit        int    `json:"limit,omitempty"`
}

// SemanticSearchResult represents a semantic search result with full document details
type SemanticSearchResult struct {
	DocumentID               interface{}            `json:"document_id"`
	CorpusName               string                 `json:"corpus_name"`
	VerseNumber              string                 `json:"verse_number,omitempty"`
	ProseNumber              string                 `json:"prose_number,omitempty"`
	ChapterNumber            int                    `json:"chapter_number"`
	Type                     string                 `json:"type,omitempty"`
	FullTranslation          string                 `json:"full_translation"`
	OriginalIast             string                 `json:"original_iast"`
	TransliteratedDevanagari string                 `json:"transliterated_devanagari,omitempty"`
	Score                    float64                `json:"score"`
	Metadata                 map[string]interface{} `json:"metadata,omitempty"`
}

// PerformSemanticSearch performs semantic search using vector embeddings
// Note: This function requires query embedding to be generated externally
// (e.g., via Python service or embedding API call)
// For a complete implementation, you would call the Python vector_search module
// or implement embedding generation in Go
func PerformSemanticSearch(
	queryEmbedding []float64,
	corpusFilter string,
	limit int,
) ([]SemanticSearchResult, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100 // Cap at 100 results
	}

	databaseName := persistence.GetVectorSearchDatabase()
	collectionName := persistence.GetVectorSearchCollection()

	results, err := persistence.SemanticSearch(
		queryEmbedding,
		databaseName,
		collectionName,
		corpusFilter,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to perform semantic search: %w", err)
	}

	// Convert persistence results to service results
	serviceResults := make([]SemanticSearchResult, len(results))
	for i, result := range results {
		serviceResults[i] = SemanticSearchResult{
			DocumentID:               result.DocumentID,
			CorpusName:               result.CorpusName,
			VerseNumber:              result.VerseNumber,
			ProseNumber:              result.ProseNumber,
			ChapterNumber:            result.ChapterNumber,
			Type:                     result.Type,
			FullTranslation:          result.FullTranslation,
			OriginalIast:             result.OriginalIast,
			TransliteratedDevanagari: result.TransliteratedDevanagari,
			Score:                    result.Score,
			Metadata:                 result.Metadata,
		}
	}

	return serviceResults, nil
}
