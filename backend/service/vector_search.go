package service

import (
	"chaatra/persistence"
	"fmt"
	"log"
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
// Supports unified search across multiple collections
func PerformSemanticSearch(
	queryEmbedding []float64,
	corpusFilter string,
	limit int,
) ([]SemanticSearchResult, error) {
	log.Printf("PerformSemanticSearch: corpusFilter=%q, limit=%d, embeddingLen=%d", corpusFilter, limit, len(queryEmbedding))

	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100 // Cap at 100 results
	}

	var databaseName string
	var collections []string
	var indexNames []string

	// If corpus filter is specified, use corpus-specific database and collection
	if corpusFilter != "" {
		databaseName = corpusFilter // Use corpus name as database name
		// Map corpus name to collection and index
		switch corpusFilter {
		case "pancatantra":
			collections = []string{"pancatantra_vector_search"}
			indexNames = []string{"vector_index_pancatantra"}
		case "hitopadesa":
			collections = []string{"hitopadesa_vector_search"}
			indexNames = []string{"vector_index_hitopadesa"}
		default:
			// For unknown corpus, fall back to unified search
			databaseName = persistence.GetVectorSearchDatabase()
			collections = persistence.GetVectorSearchCollections()
			indexNames = persistence.GetVectorSearchIndexNames()
		}
		log.Printf("PerformSemanticSearch: Using corpus-specific database=%s, collections=%v, indexNames=%v",
			databaseName, collections, indexNames)
	} else {
		// No corpus filter - search all collections in unified database
		databaseName = persistence.GetVectorSearchDatabase()
		collections = persistence.GetVectorSearchCollections()
		indexNames = persistence.GetVectorSearchIndexNames()
		log.Printf("PerformSemanticSearch: Using unified database=%s, collections=%v, indexNames=%v",
			databaseName, collections, indexNames)
	}

	results, err := persistence.SemanticSearch(
		queryEmbedding,
		databaseName,
		collections,
		indexNames,
		corpusFilter,
		limit,
	)
	if err != nil {
		log.Printf("ERROR: persistence.SemanticSearch failed: %v", err)
		return nil, fmt.Errorf("failed to perform semantic search: %w", err)
	}

	log.Printf("PerformSemanticSearch: received %d results from persistence layer", len(results))

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

	log.Printf("PerformSemanticSearch: returning %d service results", len(serviceResults))
	return serviceResults, nil
}
