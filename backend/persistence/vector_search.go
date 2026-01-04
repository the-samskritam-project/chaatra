package persistence

import (
	"chaatra/core/parser"
	"context"
	"fmt"
	"log"
	"os"
	"sort"
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
	log.Printf("SemanticSearch called: database=%s, collections=%v, indexes=%v, corpusFilter=%q, limit=%d, embeddingLen=%d",
		databaseName, collections, indexNames, corpusFilter, limit, len(queryEmbedding))

	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	if len(collections) != len(indexNames) {
		return nil, fmt.Errorf("collections and indexNames must have the same length")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db := mongoClient.Database(databaseName)
	log.Printf("Using database: %s", databaseName)

	var allResults []VectorSearchResult

	// Search each collection and combine results
	for i, collectionName := range collections {
		collection := db.Collection(collectionName)
		indexName := indexNames[i]

		log.Printf("Searching collection %s with index %s", collectionName, indexName)

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

		// Add corpus filter if specified and we're searching multiple collections
		// If we're already searching a corpus-specific collection, skip the filter
		// since all documents in that collection belong to that corpus
		if corpusFilter != "" && len(collections) > 1 {
			log.Printf("Adding corpus filter: corpus_name=%q (searching multiple collections)", corpusFilter)
			pipeline = append(pipeline, bson.M{
				"$match": bson.M{
					"corpus_name": corpusFilter,
				},
			})
		} else if corpusFilter != "" {
			log.Printf("Skipping corpus filter (already searching corpus-specific collection: %s)", collectionName)
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

		log.Printf("Executing aggregation pipeline on collection %s (index: %s)", collectionName, indexName)
		cursor, err := collection.Aggregate(ctx, pipeline)
		if err != nil {
			log.Printf("ERROR: Vector search failed for collection %s (index: %s): %v", collectionName, indexName, err)
			continue // Continue with other collections
		}

		var results []VectorSearchResult
		if err := cursor.All(ctx, &results); err != nil {
			cursor.Close(ctx)
			log.Printf("ERROR: Failed to decode results from %s: %v", collectionName, err)
			continue
		}
		cursor.Close(ctx)

		log.Printf("Found %d results from collection %s", len(results), collectionName)
		if len(results) > 0 {
			log.Printf("Sample result from %s: corpus_name=%q, chapter=%d, score=%.4f",
				collectionName, results[0].CorpusName, results[0].ChapterNumber, results[0].Score)
		}
		allResults = append(allResults, results...)
	}

	log.Printf("Combined %d results from all collections before sorting", len(allResults))

	// Sort all results by score (descending) across all collections
	sort.Slice(allResults, func(i, j int) bool {
		return allResults[i].Score > allResults[j].Score
	})

	// Limit to requested number of results
	originalCount := len(allResults)
	if len(allResults) > limit {
		allResults = allResults[:limit]
		log.Printf("Limited results from %d to %d", originalCount, limit)
	}

	log.Printf("Returning %d total results (from %d collections)", len(allResults), len(collections))
	if len(allResults) > 0 {
		log.Printf("Top result: corpus_name=%q, chapter=%d, score=%.4f",
			allResults[0].CorpusName, allResults[0].ChapterNumber, allResults[0].Score)
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
	return []string{"vector_index_hitopadesa", "vector_index_pancatantra"}
}

// ApteDictionaryResult represents a result from Apte dictionary search
type ApteDictionaryResult struct {
	ID             interface{}   `json:"_id" bson:"_id"`
	Slp1Str        string        `json:"slp1Str" bson:"slp1Str"`
	SanskritString string        `json:"sanskritString" bson:"sanskritString"`
	Meaning        string        `json:"meaning" bson:"meaning"`
	Sense          string        `json:"sense" bson:"sense"`
	PartOfSpeech   string        `json:"partOfSpeech" bson:"partOfSpeech"`
	Examples       []interface{} `json:"examples" bson:"examples"`
	Score          float64       `json:"score" bson:"score"`
}

// SearchApteDictionary performs vector search on the Apte dictionary collection
func SearchApteDictionary(queryEmbedding []float64, limit int) ([]*parser.Entry, error) {
	log.Printf("SearchApteDictionary called: limit=%d, embeddingLen=%d", limit, len(queryEmbedding))

	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	databaseName := "apte_dictionary"
	collectionName := "entries"
	indexName := "vector_index_apte"

	db := mongoClient.Database(databaseName)
	collection := db.Collection(collectionName)

	log.Printf("Searching collection %s.%s with index %s", databaseName, collectionName, indexName)

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
		{
			"$project": bson.M{
				"_id":            1,
				"slp1Str":        1,
				"sanskritString": 1,
				"meaning":        1,
				"sense":          1,
				"partOfSpeech":   1,
				"examples":       1,
				"score": bson.M{
					"$meta": "vectorSearchScore",
				},
			},
		},
	}

	log.Printf("Executing aggregation pipeline on collection %s.%s (index: %s)", databaseName, collectionName, indexName)
	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		log.Printf("ERROR: Vector search failed for collection %s.%s (index: %s): %v", databaseName, collectionName, indexName, err)
		return nil, fmt.Errorf("vector search failed: %w", err)
	}
	defer cursor.Close(ctx)

	var results []ApteDictionaryResult
	if err := cursor.All(ctx, &results); err != nil {
		log.Printf("ERROR: Failed to decode results from %s.%s: %v", databaseName, collectionName, err)
		return nil, fmt.Errorf("failed to decode results: %w", err)
	}

	log.Printf("Found %d results from collection %s.%s", len(results), databaseName, collectionName)

	// Convert to parser.Entry format
	entries := make([]*parser.Entry, len(results))
	for i, result := range results {
		// Build metadata
		metadata := make(map[string]interface{})
		metadata["id"] = result.ID
		metadata["sense"] = result.Sense
		metadata["partOfSpeech"] = result.PartOfSpeech
		metadata["examples"] = result.Examples
		metadata["score"] = result.Score

		entries[i] = &parser.Entry{
			DevanagariWord:     result.SanskritString,
			TransliteratedWord: result.Slp1Str,
			EnglishMeaning:     result.Meaning,
			Metadata:           metadata,
		}
	}

	log.Printf("Returning %d dictionary entries", len(entries))
	return entries, nil
}
