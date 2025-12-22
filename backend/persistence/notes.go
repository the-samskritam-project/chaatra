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

// Note represents a user's note
type Note struct {
	ID           interface{} `json:"id,omitempty" bson:"_id,omitempty"`
	UserID       interface{} `json:"user_id" bson:"user_id"`
	CorpusName   string      `json:"corpus_name" bson:"corpus_name"`
	CorpusUnit   string      `json:"corpus_unit" bson:"corpus_unit"`
	CorpusUnitID string      `json:"corpus_unit_id" bson:"corpus_unit_id"`
	MediaType    string      `json:"media_type" bson:"media_type"`
	Content      string      `json:"content" bson:"content"`
	CreatedAt    time.Time   `json:"created_at" bson:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at" bson:"updated_at"`
}

// NoteFilters represents filters for querying notes
type NoteFilters struct {
	CorpusName   string
	CorpusUnit   string
	CorpusUnitID string
}

// getUserNotesCollection returns the notes collection for a specific user
func getUserNotesCollection(userID interface{}) (*mongo.Collection, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	// Convert user ID to string for collection name
	userIDStr := convertUserIDToString(userID)
	collectionName := fmt.Sprintf("user_%s_notes", userIDStr)

	// Use notes database (configurable via env var)
	dbName := os.Getenv("MONGODB_NOTES_DATABASE")
	if dbName == "" {
		dbName = "notes_db" // Default
	}
	notesDB := mongoClient.Database(dbName)
	collection := notesDB.Collection(collectionName)

	return collection, nil
}

// convertUserIDToString converts a user ID (ObjectID or string) to a string representation
func convertUserIDToString(userID interface{}) string {
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

// CreateNote creates a new note for a user
func CreateNote(userID interface{}, note *Note) (*Note, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserNotesCollection(userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Set user ID and timestamps
	note.UserID = userID
	note.CreatedAt = time.Now()
	note.UpdatedAt = time.Now()
	note.MediaType = "text" // Default to text for now

	// Insert note
	result, err := collection.InsertOne(ctx, note)
	if err != nil {
		return nil, fmt.Errorf("failed to create note: %w", err)
	}

	// Set the ID from the inserted result
	note.ID = result.InsertedID
	log.Printf("Created note with ID: %v for user: %v", result.InsertedID, userID)

	return note, nil
}

// GetNotes retrieves notes for a user with optional filters
func GetNotes(userID interface{}, filters *NoteFilters) ([]Note, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserNotesCollection(userID)
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
		if filters.CorpusUnitID != "" {
			filter["corpus_unit_id"] = filters.CorpusUnitID
		}
	}

	// Sort by created_at descending (newest first)
	sortOpt := bson.D{{Key: "created_at", Value: -1}}
	cursor, err := collection.Find(ctx, filter, options.Find().SetSort(sortOpt))
	if err != nil {
		return nil, fmt.Errorf("failed to query notes: %w", err)
	}
	defer cursor.Close(ctx)

	var notes []Note
	if err := cursor.All(ctx, &notes); err != nil {
		return nil, fmt.Errorf("failed to decode notes: %w", err)
	}

	return notes, nil
}

// GetNoteByID retrieves a specific note by ID for a user
func GetNoteByID(userID interface{}, noteID string) (*Note, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserNotesCollection(userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Convert noteID string to ObjectID if possible
	var filter bson.M
	if objID, err := primitive.ObjectIDFromHex(noteID); err == nil {
		filter = bson.M{"_id": objID, "user_id": userID}
	} else {
		filter = bson.M{"_id": noteID, "user_id": userID}
	}

	var note Note
	err = collection.FindOne(ctx, filter).Decode(&note)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // Note not found
		}
		return nil, fmt.Errorf("failed to query note: %w", err)
	}

	return &note, nil
}

// UpdateNote updates the content of a note
func UpdateNote(userID interface{}, noteID string, content string) (*Note, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserNotesCollection(userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Convert noteID string to ObjectID if possible
	var filter bson.M
	if objID, err := primitive.ObjectIDFromHex(noteID); err == nil {
		filter = bson.M{"_id": objID, "user_id": userID}
	} else {
		filter = bson.M{"_id": noteID, "user_id": userID}
	}

	// Update note content and updated_at timestamp
	update := bson.M{
		"$set": bson.M{
			"content":    content,
			"updated_at": time.Now(),
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return nil, fmt.Errorf("failed to update note: %w", err)
	}

	if result.MatchedCount == 0 {
		return nil, fmt.Errorf("note not found or does not belong to user")
	}

	// Retrieve updated note
	note, err := GetNoteByID(userID, noteID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve updated note: %w", err)
	}

	return note, nil
}

// InitNotesIndexes creates indexes on the notes collections
func InitNotesIndexes() {
	if mongoClient == nil {
		log.Println("MongoDB not initialized, skipping notes indexes initialization")
		return
	}

	// This will be called when a user creates their first note
	// For now, we'll create indexes on-demand in CreateNote
	log.Println("Notes indexes will be created on-demand when users create notes")
}
