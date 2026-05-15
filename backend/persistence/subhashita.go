package persistence

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
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
	PrimaryTheme               string            `json:"primary_theme,omitempty" bson:"primary_theme,omitempty"`
	SecondaryThemes            []string          `json:"secondary_themes,omitempty" bson:"secondary_themes,omitempty"`
	ThemeRationale             string            `json:"theme_rationale,omitempty" bson:"theme_rationale,omitempty"`
	TranslationModel           string            `json:"translation_model,omitempty" bson:"translation_model,omitempty"`
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

// ThemeCount summarises one theme — its name and how many enriched
// subhashitas have it as their primary_theme.
type ThemeCount struct {
	Theme string `json:"theme"`
	Count int    `json:"count"`
}

// GetSubhashitaThemes returns the list of primary_theme values that
// appear at least minCount times, sorted by descending count. Used to
// build the theme chip strip in the reader.
func GetSubhashitaThemes(minCount int) ([]ThemeCount, error) {
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

	if minCount < 1 {
		minCount = 1
	}

	pipeline := []bson.M{
		{"$match": bson.M{
			"primary_theme": bson.M{"$exists": true, "$nin": bson.A{"", nil}},
		}},
		{"$group": bson.M{
			"_id":   "$primary_theme",
			"count": bson.M{"$sum": 1},
		}},
		{"$match": bson.M{"count": bson.M{"$gte": minCount}}},
		{"$sort": bson.M{"count": -1}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate themes: %w", err)
	}
	defer cursor.Close(ctx)

	type aggRow struct {
		ID    string `bson:"_id"`
		Count int    `bson:"count"`
	}
	var rows []aggRow
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, fmt.Errorf("failed to decode theme aggregation: %w", err)
	}

	out := make([]ThemeCount, 0, len(rows))
	for _, r := range rows {
		out = append(out, ThemeCount{Theme: r.ID, Count: r.Count})
	}
	return out, nil
}

// GetSubhashitasByTheme returns every enriched subhashita whose
// primary_theme matches the given value, sorted by verse_number.
// Caller can pass limit <= 0 for no limit.
func GetSubhashitasByTheme(theme string, limit int) ([]SubhashitaVerse, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}
	if theme == "" {
		return nil, fmt.Errorf("theme is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	db := getDatabase("subhashita")
	if db == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}
	collection := db.Collection("mahasubhasitasamgraha")

	filter := bson.M{
		"primary_theme":     theme,
		"translation_model": bson.M{"$exists": true, "$nin": bson.A{"", nil}},
	}

	findOpts := options.Find().SetSort(bson.D{{Key: "verse_number", Value: 1}})
	if limit > 0 {
		findOpts = findOpts.SetLimit(int64(limit))
	}

	cursor, err := collection.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to query subhashitas by theme: %w", err)
	}
	defer cursor.Close(ctx)

	var verses []SubhashitaVerse
	if err := cursor.All(ctx, &verses); err != nil {
		return nil, fmt.Errorf("failed to decode subhashitas by theme: %w", err)
	}
	return verses, nil
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
