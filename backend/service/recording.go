package service

import (
	"chaatra/persistence"
	"context"
	"fmt"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// RecordingMetadata represents recording information stored in verse documents
type RecordingMetadata struct {
	AudioURL            string      `json:"audio_url" bson:"audio_url"`
	AudioDuration       float64     `json:"audio_duration" bson:"audio_duration"` // in seconds
	RecordingUploadedAt time.Time   `json:"recording_uploaded_at" bson:"recording_uploaded_at"`
	RecordingUploadedBy interface{} `json:"recording_uploaded_by" bson:"recording_uploaded_by"`
}

// VerseFilterInfo contains collection name and filter for a verse
type VerseFilterInfo struct {
	Collection string
	Filter     bson.M
}

// getVerseFilter determines the collection and filter for a verse based on corpus and verse ID
func getVerseFilter(corpusName, verseID string) (*VerseFilterInfo, error) {
	switch corpusName {
	case "aditya_hridaya_stotra":
		// Aditya Hridaya uses "verses" collection
		// Verse ID can be _id (string) or shloka (int)
		filter := bson.M{}
		if shlokaNum, err := strconv.Atoi(verseID); err == nil {
			filter["shloka"] = shlokaNum
		} else {
			// Try as _id (could be ObjectID string or regular string)
			// MongoDB will handle the conversion
			filter["_id"] = verseID
		}
		return &VerseFilterInfo{
			Collection: "verses",
			Filter:     filter,
		}, nil

	case "subhashita":
		// Subhashita uses "mahasubhasitasamgraha" collection
		// Verse ID is verse_number (string)
		return &VerseFilterInfo{
			Collection: "mahasubhasitasamgraha",
			Filter:     bson.M{"verse_number": verseID},
		}, nil

	case "bhagavad_gita":
		// Bhagavad Gita uses chapter collections: "bhagavad_gita_chapter_{n}"
		// Verse ID format: "chapter.verse" (e.g., "1.1")
		parts := splitVerseID(verseID, ".")
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid verse ID format for bhagavad_gita: expected 'chapter.verse', got '%s'", verseID)
		}
		chapterNum := parts[0]
		return &VerseFilterInfo{
			Collection: fmt.Sprintf("bhagavad_gita_chapter_%s", chapterNum),
			Filter:     bson.M{"verse_number": verseID},
		}, nil

	case "hitopadesa", "pancatantra":
		// These use chapter collections: "{corpus}_chapter_{n}"
		// Verse ID format: "chapter.verse" or just verse number
		parts := splitVerseID(verseID, ".")
		var collection string
		var filter bson.M

		if len(parts) == 2 {
			// Format: "chapter.verse"
			collection = fmt.Sprintf("%s_chapter_%s", corpusName, parts[0])
			filter = bson.M{"verse_number": verseID}
		} else {
			// Just verse number - need to search across chapters
			// For simplicity, we'll require chapter.verse format
			return nil, fmt.Errorf("verse ID must be in format 'chapter.verse' for %s", corpusName)
		}

		return &VerseFilterInfo{
			Collection: collection,
			Filter:     filter,
		}, nil

	default:
		// Generic fallback: try common patterns
		// First, try as verse_number in a "verses" collection
		return &VerseFilterInfo{
			Collection: "verses",
			Filter:     bson.M{"verse_number": verseID},
		}, nil
	}
}

// splitVerseID splits a verse ID by separator, handling edge cases
func splitVerseID(verseID, sep string) []string {
	if verseID == "" {
		return []string{}
	}
	parts := []string{}
	current := ""
	for _, char := range verseID {
		if string(char) == sep {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

// SaveRecording saves recording metadata to a verse document
func SaveRecording(corpusName, verseID string, audioURL string, duration float64, uploadedBy interface{}) error {

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get collection and filter for this verse
	filterInfo, err := getVerseFilter(corpusName, verseID)
	if err != nil {
		return fmt.Errorf("failed to get verse filter: %w", err)
	}

	// Get database for corpus
	db := persistence.GetDatabase(corpusName)
	if db == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	collection := db.Collection(filterInfo.Collection)

	// Update verse document with recording metadata
	update := bson.M{
		"$set": bson.M{
			"audio_url":             audioURL,
			"audio_duration":        duration,
			"recording_uploaded_at": time.Now(),
			"recording_uploaded_by": uploadedBy,
		},
	}

	result, err := collection.UpdateOne(ctx, filterInfo.Filter, update)
	if err != nil {
		return fmt.Errorf("failed to update verse with recording: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("verse not found: corpus=%s, id=%s", corpusName, verseID)
	}

	return nil
}

// GetRecording retrieves recording metadata from a verse document
func GetRecording(corpusName, verseID string) (audioURL string, duration float64, exists bool, err error) {

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get collection and filter for this verse
	filterInfo, err := getVerseFilter(corpusName, verseID)
	if err != nil {
		return "", 0, false, fmt.Errorf("failed to get verse filter: %w", err)
	}

	// Get database for corpus
	db := persistence.GetDatabase(corpusName)
	if db == nil {
		return "", 0, false, fmt.Errorf("MongoDB not initialized")
	}

	collection := db.Collection(filterInfo.Collection)

	// Find verse and extract recording fields
	var result bson.M
	err = collection.FindOne(ctx, filterInfo.Filter).Decode(&result)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return "", 0, false, nil // Verse not found, no recording
		}
		return "", 0, false, fmt.Errorf("failed to query verse: %w", err)
	}

	// Extract recording fields
	if audioURLVal, ok := result["audio_url"]; ok && audioURLVal != nil {
		audioURL, _ = audioURLVal.(string)
	}
	if durationVal, ok := result["audio_duration"]; ok && durationVal != nil {
		if d, ok := durationVal.(float64); ok {
			duration = d
		} else if d, ok := durationVal.(int64); ok {
			duration = float64(d)
		} else if d, ok := durationVal.(int); ok {
			duration = float64(d)
		}
	}

	exists = audioURL != ""
	return audioURL, duration, exists, nil
}
