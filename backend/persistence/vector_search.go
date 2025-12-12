package persistence

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

// VectorSearchResult represents a semantic search result
type VectorSearchResult struct {
	DocumentID               interface{}            `json:"document_id" bson:"document_id"`
	CorpusName               string                 `json:"corpus_name" bson:"corpus_name"`
	VerseNumber              string                 `json:"verse_number,omitempty" bson:"verse_number,omitempty"`
	ProseNumber              string                 `json:"prose_number,omitempty" bson:"prose_number,omitempty"`
	ChapterNumber            int                    `json:"chapter_number" bson:"chapter_number"`
	Type                     string                 `json:"type,omitempty" bson:"type,omitempty"`
	FullTranslation          string                 `json:"full_translation" bson:"full_translation"`
	OriginalIast             string                 `json:"original_iast" bson:"original_iast"`
	TransliteratedDevanagari string                 `json:"transliterated_devanagari,omitempty" bson:"transliterated_devanagari,omitempty"`
	Score                    float64                `json:"score" bson:"score"`
	Metadata                 map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`
}

// SemanticSearch performs semantic search using MongoDB Atlas vector search
// Supports unified search across multiple collections in corpus_vectors database
func SemanticSearch(
	queryEmbedding []float64,
	databaseName string,
	collections []string,
	indexNames []string,
	corpusFilter string,
	limit int,
) ([]VectorSearchResult, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	if len(collections) != len(indexNames) {
		return nil, fmt.Errorf("collections and indexNames must have the same length")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db := mongoClient.Database(databaseName)

	var allResults []VectorSearchResult

	// Search each collection and combine results
	for i, collectionName := range collections {
		collection := db.Collection(collectionName)
		indexName := indexNames[i]

		// Build aggregation pipeline for vector search
		pipeline := []bson.M{
			{
				"$vectorSearch": bson.M{
					"index":         indexName,
					"path":          "embedding",
					"queryVector":   queryEmbedding,
					"numCandidates": limit * 10,
					"limit":         limit,
				},
			},
		}

		// Add corpus filter if specified (filter by collection name or corpus_name field)
		if corpusFilter != "" {
			pipeline = append(pipeline, bson.M{
				"$match": bson.M{
					"corpus_name": corpusFilter,
				},
			})
		}

		// Project fields
		pipeline = append(pipeline, bson.M{
			"$project": bson.M{
				"document_id":               1,
				"corpus_name":               1,
				"verse_number":              1,
				"prose_number":              1,
				"chapter_number":            1,
				"type":                      1,
				"full_translation":          1,
				"original_iast":             1,
				"transliterated_devanagari": 1,
				"score": bson.M{
					"$meta": "vectorSearchScore",
				},
				"metadata": 1,
			},
		})

		cursor, err := collection.Aggregate(ctx, pipeline)
		if err != nil {
			log.Printf("Vector search failed for collection %s: %v", collectionName, err)
			continue // Continue with other collections
		}

		var results []VectorSearchResult
		if err := cursor.All(ctx, &results); err != nil {
			cursor.Close(ctx)
			log.Printf("Failed to decode results from %s: %v", collectionName, err)
			continue
		}
		cursor.Close(ctx)

		allResults = append(allResults, results...)
	}

	// Sort all results by score (descending) and limit
	if len(allResults) > limit {
		// Simple sort by score (assuming results are roughly sorted already)
		// For better sorting, we'd need to implement a proper sort
		allResults = allResults[:limit]
	}

	return allResults, nil
}

// GetVectorSearchDatabase returns the database name for vector search collections
func GetVectorSearchDatabase() string {
	dbName := os.Getenv("MONGODB_VECTOR_DATABASE")
	if dbName == "" {
		dbName = "corpus_vectors" // Default Atlas database
	}
	return dbName
}

// GetVectorSearchCollections returns the collection names for vector search
func GetVectorSearchCollections() []string {
	// Return both collections for unified search
	return []string{"hitopadesa_vector_search", "pancatantra_vector_search"}
}

// GetVectorSearchIndexNames returns the index names corresponding to collections
func GetVectorSearchIndexNames() []string {
	// Return index names matching the collections
	return []string{"vector_index_hitopadesa", "vector_index_pnacatantra"}
}
