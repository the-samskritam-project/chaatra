package persistence

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var mongoClient *mongo.Client
var mongoDB *mongo.Database

// HitopadesaChapterMetadata represents chapter metadata
type HitopadesaChapterMetadata struct {
	ChapterNumber int       `json:"chapter_number" bson:"chapter_number"`
	VerseCount    int       `json:"verse_count" bson:"verse_count"`
	FirstVerse    string    `json:"first_verse" bson:"first_verse"`
	LastVerse     string    `json:"last_verse" bson:"last_verse"`
	CreatedAt     time.Time `json:"created_at" bson:"created_at"`
}

// WordTranslation represents a single word and its translation
type WordTranslation struct {
	Word        string `json:"word" bson:"word"`
	Translation string `json:"translation" bson:"translation"`
}

// HitopadesaVerse represents a verse document
type HitopadesaVerse struct {
	VerseNumber              string            `json:"verse_number" bson:"verse_number"`
	ChapterNumber            int               `json:"chapter_number" bson:"chapter_number"`
	VerseIndex               int               `json:"verse_index" bson:"verse_index"`
	OriginalIast             string            `json:"original_iast" bson:"original_iast"`
	TransliteratedDevanagari string            `json:"transliterated_devanagari" bson:"transliterated_devanagari"`
	WordByWordTranslation    []WordTranslation `json:"word_by_word_translation" bson:"word_by_word_translation"`
	FullTranslation          string            `json:"full_translation" bson:"full_translation"`
}

// InitMongoDB initializes MongoDB connection
func InitMongoDB() {
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		log.Println("MongoDB not initialized (set MONGODB_URI env var to enable)")
		return
	}

	databaseName := os.Getenv("MONGODB_DATABASE")
	if databaseName == "" {
		databaseName = "hitopadesa"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Printf("Failed to connect to MongoDB: %v", err)
		return
	}

	// Test connection
	if err := client.Ping(ctx, nil); err != nil {
		log.Printf("Failed to ping MongoDB: %v", err)
		return
	}

	mongoClient = client
	mongoDB = client.Database(databaseName)
	log.Printf("MongoDB initialized: %s (database: %s)", mongoURI, databaseName)
}

// GetHitopadesaChapters returns all chapter metadata
func GetHitopadesaChapters() ([]HitopadesaChapterMetadata, error) {
	if mongoDB == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := mongoDB.Collection("hitopadesa_chapters")
	sortOpt := bson.D{{Key: "chapter_number", Value: 1}}
	cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(sortOpt))
	if err != nil {
		return nil, fmt.Errorf("failed to query chapters: %w", err)
	}
	defer cursor.Close(ctx)

	var chapters []HitopadesaChapterMetadata
	if err := cursor.All(ctx, &chapters); err != nil {
		return nil, fmt.Errorf("failed to decode chapters: %w", err)
	}

	return chapters, nil
}

// GetHitopadesaVerses returns all verses for a given chapter
func GetHitopadesaVerses(chapterNumber int) ([]HitopadesaVerse, error) {
	if mongoDB == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collectionName := fmt.Sprintf("hitopadesa_chapter_%d", chapterNumber)
	collection := mongoDB.Collection(collectionName)

	sortOpt := bson.D{{Key: "verse_index", Value: 1}}
	cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(sortOpt))
	if err != nil {
		return nil, fmt.Errorf("failed to query verses for chapter %d: %w", chapterNumber, err)
	}
	defer cursor.Close(ctx)

	var verses []HitopadesaVerse
	if err := cursor.All(ctx, &verses); err != nil {
		return nil, fmt.Errorf("failed to decode verses: %w", err)
	}

	return verses, nil
}
