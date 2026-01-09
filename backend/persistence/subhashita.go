package persistence

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// SubhashitaVerse represents a subhashita verse document
type SubhashitaVerse struct {
	ID                         interface{}       `json:"_id,omitempty" bson:"_id,omitempty"`
	Type                       string            `json:"type" bson:"type"`
	VerseNumber                string            `json:"verse_number" bson:"verse_number"`
	OriginalIast               string            `json:"original_iast" bson:"original_iast"`
	TransliteratedDevanagari   string            `json:"transliterated_devanagari" bson:"transliterated_devanagari"`
	FullTranslation            string            `json:"full_translation" bson:"full_translation"`
	SplitShloka                string            `json:"split_shloka,omitempty" bson:"split_shloka,omitempty"`
	SplitWordByWordTranslation []WordTranslation `json:"split_word_by_word_translation,omitempty" bson:"split_word_by_word_translation,omitempty"`
	AudioURL                   *string           `json:"audio_url,omitempty" bson:"audio_url,omitempty"`
	AudioDuration              *float64          `json:"audio_duration,omitempty" bson:"audio_duration,omitempty"`
	RecordingUploadedAt        *time.Time        `json:"recording_uploaded_at,omitempty" bson:"recording_uploaded_at,omitempty"`
	RecordingUploadedBy        interface{}       `json:"recording_uploaded_by,omitempty" bson:"recording_uploaded_by,omitempty"`
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

// GetSubhashitaByVerseNumber retrieves a subhashita verse by verse number
func GetSubhashitaByVerseNumber(verseNumber string) (*SubhashitaVerse, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db := getDatabase("subhashita")
	if db == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection := db.Collection("mahasubhasitasamgraha")

	filter := bson.M{"verse_number": verseNumber}

	var verse SubhashitaVerse
	err := collection.FindOne(ctx, filter).Decode(&verse)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("subhashita verse %s not found", verseNumber)
		}
		return nil, fmt.Errorf("failed to query subhashita: %w", err)
	}

	return &verse, nil
}

// UpdateSubhashitaSplit updates the split shloka and word-by-word translation for a verse
func UpdateSubhashitaSplit(verseNumber string, splitShloka string, splitWordByWord []WordTranslation) error {
	if mongoClient == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db := getDatabase("subhashita")
	if db == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	collection := db.Collection("mahasubhasitasamgraha")

	filter := bson.M{"verse_number": verseNumber}

	update := bson.M{
		"$set": bson.M{
			"split_shloka":                   splitShloka,
			"split_word_by_word_translation": splitWordByWord,
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update subhashita split: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("subhashita verse %s not found", verseNumber)
	}

	log.Printf("Updated split for subhashita verse %s", verseNumber)
	return nil
}
