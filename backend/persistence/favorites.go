package persistence

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Favorite represents a user's favorite verse
type Favorite struct {
	ID           interface{} `json:"id,omitempty" bson:"_id,omitempty"`
	UserID       interface{} `json:"user_id" bson:"user_id"`
	CorpusName   string      `json:"corpus_name" bson:"corpus_name"`
	CorpusUnit   string      `json:"corpus_unit" bson:"corpus_unit"`
	CorpusUnitID string      `json:"corpus_unit_id" bson:"corpus_unit_id"`
	CreatedAt    time.Time   `json:"created_at" bson:"created_at"`
}

// FavoriteFilters represents filters for querying favorites
type FavoriteFilters struct {
	CorpusName string
	CorpusUnit string
}

// getUserFavoritesCollection returns the favorites collection for a specific user
func getUserFavoritesCollection(userID interface{}) (*mongo.Collection, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	// Convert user ID to string for collection name
	userIDStr := convertUserIDToStringForFavorites(userID)
	collectionName := fmt.Sprintf("user_%s_favorites", userIDStr)

	// Use favorites database (configurable via env var)
	dbName := os.Getenv("MONGODB_FAVORITES_DATABASE")
	if dbName == "" {
		dbName = "favorites_db" // Default
	}
	favoritesDB := mongoClient.Database(dbName)
	collection := favoritesDB.Collection(collectionName)

	// Create unique compound index on first access
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexModel := mongo.IndexModel{
		Keys: bson.D{
			{Key: "user_id", Value: 1},
			{Key: "corpus_name", Value: 1},
			{Key: "corpus_unit", Value: 1},
			{Key: "corpus_unit_id", Value: 1},
		},
		Options: options.Index().SetUnique(true),
	}

	_, err := collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		// Index might already exist, log but don't fail
		log.Printf("Note: Could not create unique index on favorites (may already exist): %v", err)
	}

	return collection, nil
}

// convertUserIDToStringForFavorites converts a user ID (ObjectID or string) to a string representation
func convertUserIDToStringForFavorites(userID interface{}) string {
	if userID == nil {
		return ""
	}

	// If it's already a string, return it
	if str, ok := userID.(string); ok {
		return str
	}

	// If it's an ObjectID, convert to hex string
	if objID, ok := userID.(primitive.ObjectID); ok {
		return objID.Hex()
	}

	// Try to convert to ObjectID if it's a string representation
	if str, ok := userID.(string); ok {
		if objID, err := primitive.ObjectIDFromHex(str); err == nil {
			return objID.Hex()
		}
		return str
	}

	// Fallback: convert to string
	return fmt.Sprintf("%v", userID)
}

// CreateFavorite creates a new favorite for a user
func CreateFavorite(userID interface{}, favorite *Favorite) (*Favorite, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserFavoritesCollection(userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Set user ID and timestamp
	favorite.UserID = userID
	favorite.CreatedAt = time.Now()

	// Insert favorite
	result, err := collection.InsertOne(ctx, favorite)
	if err != nil {
		// Check if it's a duplicate key error (already favorited)
		if mongo.IsDuplicateKeyError(err) {
			return nil, fmt.Errorf("verse is already favorited")
		}
		return nil, fmt.Errorf("failed to create favorite: %w", err)
	}

	// Set the ID from the inserted result
	favorite.ID = result.InsertedID
	log.Printf("Created favorite with ID: %v for user: %v", result.InsertedID, userID)

	return favorite, nil
}

// DeleteFavorite removes a favorite for a user
func DeleteFavorite(userID interface{}, corpusName, corpusUnit, corpusUnitID string) error {
	if mongoClient == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserFavoritesCollection(userID)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Build filter
	filter := bson.M{
		"user_id":        userID,
		"corpus_name":    corpusName,
		"corpus_unit":    corpusUnit,
		"corpus_unit_id": corpusUnitID,
	}

	result, err := collection.DeleteOne(ctx, filter)
	if err != nil {
		return fmt.Errorf("failed to delete favorite: %w", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("favorite not found")
	}

	log.Printf("Deleted favorite for user: %v, verse: %s", userID, corpusUnitID)
	return nil
}

// GetFavorite checks if a favorite exists for a user
func GetFavorite(userID interface{}, corpusName, corpusUnit, corpusUnitID string) (*Favorite, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserFavoritesCollection(userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Build filter
	filter := bson.M{
		"user_id":        userID,
		"corpus_name":    corpusName,
		"corpus_unit":    corpusUnit,
		"corpus_unit_id": corpusUnitID,
	}

	var favorite Favorite
	err = collection.FindOne(ctx, filter).Decode(&favorite)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // Favorite not found
		}
		return nil, fmt.Errorf("failed to query favorite: %w", err)
	}

	return &favorite, nil
}

// GetFavorites retrieves favorites for a user with optional filters
func GetFavorites(userID interface{}, filters *FavoriteFilters) ([]Favorite, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserFavoritesCollection(userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Build filter query
	filter := bson.M{"user_id": userID}
	if filters != nil {
		if filters.CorpusName != "" {
			filter["corpus_name"] = filters.CorpusName
		}
		if filters.CorpusUnit != "" {
			filter["corpus_unit"] = filters.CorpusUnit
		}
	}

	// Sort by created_at descending (newest first)
	sortOpt := bson.D{{Key: "created_at", Value: -1}}
	cursor, err := collection.Find(ctx, filter, options.Find().SetSort(sortOpt))
	if err != nil {
		return nil, fmt.Errorf("failed to query favorites: %w", err)
	}
	defer cursor.Close(ctx)

	var favorites []Favorite
	if err := cursor.All(ctx, &favorites); err != nil {
		return nil, fmt.Errorf("failed to decode favorites: %w", err)
	}

	return favorites, nil
}

