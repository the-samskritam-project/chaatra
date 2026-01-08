package persistence

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ConversationCacheEntry represents a cached conversation response
// We use bson.M for Response to avoid import cycle with service package
type ConversationCacheEntry struct {
	ID                       string                 `bson:"_id" json:"id"`
	ShlokaID                 string                 `bson:"shloka_id" json:"shloka_id"`
	RevealedUncompoundedHash string                 `bson:"revealed_uncompounded_hash" json:"revealed_uncompounded_hash"`
	RevealedWordHash         string                 `bson:"revealed_word_hash" json:"revealed_word_hash"`
	UserMessageHash          string                 `bson:"user_message_hash" json:"user_message_hash"`
	Response                 map[string]interface{} `bson:"response" json:"response"` // Store as generic map to avoid import cycle
	CreatedAt                time.Time              `bson:"created_at" json:"created_at"`
	ExpiresAt                time.Time              `bson:"expires_at" json:"expires_at"`
}

// hashIndices creates a deterministic hash of integer indices
func hashIndices(indices []int) string {
	data, err := json.Marshal(indices)
	if err != nil {
		return ""
	}
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// hashString creates a SHA256 hash of a string
func hashString(s string) string {
	hash := sha256.Sum256([]byte(s))
	return hex.EncodeToString(hash[:])
}

// generateCacheKey creates a composite cache key from shloka ID, revealed indices, and user message
func generateCacheKey(shlokaID string, revealedUncompounded []int, revealedWords []int, userMessage string) string {
	uncompoundedHash := hashIndices(revealedUncompounded)
	wordHash := hashIndices(revealedWords)
	messageHash := hashString(userMessage)

	key := fmt.Sprintf("%s:%s:%s:%s", shlokaID, uncompoundedHash, wordHash, messageHash)
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}

// GetCachedResponse retrieves a cached conversation response
// Returns the response as a map[string]interface{} to avoid import cycle
func GetCachedResponse(shlokaID string, revealedUncompounded []int, revealedWords []int, userMessage string) (map[string]interface{}, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use a shared database for cache (or create a new one)
	// For now, we'll use the first available database or create a cache database
	db := mongoClient.Database("conversation_cache")
	collection := db.Collection("responses")

	cacheKey := generateCacheKey(shlokaID, revealedUncompounded, revealedWords, userMessage)

	filter := bson.M{
		"_id": cacheKey,
		"expires_at": bson.M{
			"$gt": time.Now(), // Only return non-expired entries
		},
	}

	var entry ConversationCacheEntry
	err := collection.FindOne(ctx, filter).Decode(&entry)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // Cache miss - not an error
		}
		return nil, fmt.Errorf("failed to query cache: %w", err)
	}

	log.Printf("Cache hit for shloka %s", shlokaID)
	return entry.Response, nil
}

// CacheResponse stores a conversation response in the cache
// Accepts response as map[string]interface{} to avoid import cycle
func CacheResponse(shlokaID string, revealedUncompounded []int, revealedWords []int, userMessage string, response map[string]interface{}, ttlDays int) error {
	if mongoClient == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db := mongoClient.Database("conversation_cache")
	collection := db.Collection("responses")

	cacheKey := generateCacheKey(shlokaID, revealedUncompounded, revealedWords, userMessage)
	now := time.Now()
	expiresAt := now.Add(time.Duration(ttlDays) * 24 * time.Hour)

	entry := ConversationCacheEntry{
		ID:                       cacheKey,
		ShlokaID:                 shlokaID,
		RevealedUncompoundedHash: hashIndices(revealedUncompounded),
		RevealedWordHash:         hashIndices(revealedWords),
		UserMessageHash:          hashString(userMessage),
		Response:                 response,
		CreatedAt:                now,
		ExpiresAt:                expiresAt,
	}

	// Use upsert to update if exists, insert if not
	upsert := true
	opts := options.Update().SetUpsert(upsert)
	_, err := collection.UpdateOne(
		ctx,
		bson.M{"_id": cacheKey},
		bson.M{"$set": entry},
		opts,
	)
	if err != nil {
		return fmt.Errorf("failed to cache response: %w", err)
	}

	log.Printf("Cached response for shloka %s (key: %s)", shlokaID, cacheKey[:16])
	return nil
}

// InvalidateCache removes cached responses for a specific shloka
func InvalidateCache(shlokaID string) error {
	if mongoClient == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db := mongoClient.Database("conversation_cache")
	collection := db.Collection("responses")

	filter := bson.M{"shloka_id": shlokaID}
	result, err := collection.DeleteMany(ctx, filter)
	if err != nil {
		return fmt.Errorf("failed to invalidate cache: %w", err)
	}

	log.Printf("Invalidated %d cache entries for shloka %s", result.DeletedCount, shlokaID)
	return nil
}
