package persistence

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

// SubhashitaVerse represents a subhashita verse document
type SubhashitaVerse struct {
	ID                       interface{} `json:"_id,omitempty" bson:"_id,omitempty"`
	Type                     string      `json:"type" bson:"type"`
	VerseNumber              string      `json:"verse_number" bson:"verse_number"`
	OriginalIast             string      `json:"original_iast" bson:"original_iast"`
	TransliteratedDevanagari string      `json:"transliterated_devanagari" bson:"transliterated_devanagari"`
	FullTranslation          string      `json:"full_translation" bson:"full_translation"`
}

// GetRandomSubhashita returns a random verse from the mahasubhasitasamgraha collection
func GetRandomSubhashita() (*SubhashitaVerse, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use subhashita database
	db := getDatabase("subhashita")
	if db == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection := db.Collection("mahasubhasitasamgraha")

	// Use $sample aggregation to get a random document
	pipeline := []bson.M{
		{
			"$sample": bson.M{
				"size": 1,
			},
		},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to get random subhashita: %w", err)
	}
	defer cursor.Close(ctx)

	var verses []SubhashitaVerse
	if err := cursor.All(ctx, &verses); err != nil {
		return nil, fmt.Errorf("failed to decode subhashita: %w", err)
	}

	if len(verses) == 0 {
		return nil, fmt.Errorf("no subhashita found")
	}

	log.Printf("GetRandomSubhashita: returned verse %s", verses[0].VerseNumber)
	return &verses[0], nil
}

