package persistence

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AdityaHridayaVerse represents a verse from the Aditya Hridaya Stotra
type AdityaHridayaVerse struct {
	ID              string    `json:"_id" bson:"_id"`
	Kanda           string    `json:"kanda" bson:"kanda"`
	Sarga           int       `json:"sarga" bson:"sarga"`
	Shloka          int       `json:"shloka" bson:"shloka"`
	ShlokaText      string    `json:"shloka_text" bson:"shloka_text"`
	Transliteration *string   `json:"transliteration,omitempty" bson:"transliteration,omitempty"`
	Translation     string    `json:"translation" bson:"translation"`
	Explanation     string    `json:"explanation" bson:"explanation"`
	Comments        *string   `json:"comments,omitempty" bson:"comments,omitempty"`
	CreatedAt       time.Time `json:"created_at" bson:"created_at"`
}

// GetAdityaHridayaVerses returns all verses from the Aditya Hridaya Stotra
func GetAdityaHridayaVerses() ([]AdityaHridayaVerse, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use aditya_hridaya_stotra database
	db := getDatabase("aditya_hridaya_stotra")
	if db == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection := db.Collection("verses")

	// Sort by shloka number
	sortOpt := bson.D{{Key: "shloka", Value: 1}}
	cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(sortOpt))
	if err != nil {
		return nil, fmt.Errorf("failed to query verses: %w", err)
	}
	defer cursor.Close(ctx)

	var verses []AdityaHridayaVerse
	if err := cursor.All(ctx, &verses); err != nil {
		return nil, fmt.Errorf("failed to decode verses: %w", err)
	}

	log.Printf("GetAdityaHridayaVerses: returned %d verses", len(verses))
	return verses, nil
}
