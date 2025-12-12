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

// SemanticSearch performs semantic search using MongoDB vector search
// Note: This is a placeholder that calls a Python service or uses direct MongoDB queries
// For full implementation, you may want to call the Python vector_search module
// or implement vector search directly in Go using MongoDB aggregation pipeline
func SemanticSearch(
	queryEmbedding []float64,
	databaseName string,
	collectionName string,
	corpusFilter string,
	limit int,
) ([]VectorSearchResult, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db := mongoClient.Database(databaseName)
	collection := db.Collection(collectionName)

	// Build aggregation pipeline for vector search
	pipeline := []bson.M{
		{
			"$vectorSearch": bson.M{
				"index":         "corpus_translation_vector_index",
				"path":          "embedding",
				"queryVector":   queryEmbedding,
				"numCandidates": limit * 10,
				"limit":         limit,
			},
		},
	}

	// Add corpus filter if specified
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
		// If vector search fails, it might not be available
		// Log the error but don't fail completely
		log.Printf("Vector search failed (may not be available): %v", err)
		return nil, fmt.Errorf("vector search failed: %w", err)
	}
	defer cursor.Close(ctx)

	var results []VectorSearchResult
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("failed to decode results: %w", err)
	}

	return results, nil
}

// GetVectorSearchDatabase returns the database name for vector search collection
func GetVectorSearchDatabase() string {
	dbName := os.Getenv("MONGODB_VECTOR_DATABASE")
	if dbName == "" {
		// Default to hitopadesa database if not specified
		dbName = os.Getenv("MONGODB_DATABASE")
		if dbName == "" {
			dbName = "hitopadesa"
		}
	}
	return dbName
}

// GetVectorSearchCollection returns the collection name for vector search
func GetVectorSearchCollection() string {
	collectionName := os.Getenv("MONGODB_VECTOR_COLLECTION")
	if collectionName == "" {
		collectionName = "corpus_vector_search"
	}
	return collectionName
}
