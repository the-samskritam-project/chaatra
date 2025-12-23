package persistence

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var mongoClient *mongo.Client
var mongoDB *mongo.Database

// getDatabase returns the database for a given corpus name
func getDatabase(corpusName string) *mongo.Database {
	if mongoClient == nil {
		return nil
	}
	// Use corpus name as database name
	return mongoClient.Database(corpusName)
}

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

// EditedTranslation represents an edited translation with timestamp
type EditedTranslation struct {
	Translation string    `json:"translation" bson:"translation"`
	EditedAt    time.Time `json:"edited_at" bson:"edited_at"`
}

// HitopadesaVerse represents a verse or prose document
type HitopadesaVerse struct {
	ID                         interface{}         `json:"_id,omitempty" bson:"_id,omitempty"` // MongoDB _id field
	Type                       string              `json:"type" bson:"type"`                   // "verse" or "prose"
	VerseNumber                string              `json:"verse_number,omitempty" bson:"verse_number,omitempty"`
	ProseNumber                string              `json:"prose_number,omitempty" bson:"prose_number,omitempty"`
	ChapterNumber              int                 `json:"chapter_number" bson:"chapter_number"`
	VerseIndex                 int                 `json:"verse_index,omitempty" bson:"verse_index,omitempty"`                       // For verses
	ProseIndex                 int                 `json:"prose_index,omitempty" bson:"prose_index,omitempty"`                       // For prose
	SequenceIndex              *int                `json:"sequence_index,omitempty" bson:"sequence_index,omitempty"`                 // Global sequence index
	ChapterSequenceIndex       int                 `json:"chapter_sequence_index,omitempty" bson:"chapter_sequence_index,omitempty"` // Sequence within chapter
	OriginalIast               string              `json:"original_iast" bson:"original_iast"`
	TransliteratedDevanagari   string              `json:"transliterated_devanagari" bson:"transliterated_devanagari"`
	WordByWordTranslation      []WordTranslation   `json:"word_by_word_translation" bson:"word_by_word_translation"`
	FullTranslation            string              `json:"full_translation" bson:"full_translation"`
	EditedTranslations         []EditedTranslation `json:"edited_translations" bson:"edited_translations"`
	SplitShloka                string              `json:"split_shloka,omitempty" bson:"split_shloka,omitempty"`                                     // Uncompounded version
	SplitWordByWordTranslation []WordTranslation   `json:"split_word_by_word_translation,omitempty" bson:"split_word_by_word_translation,omitempty"` // Word-by-word from split
	SplitAt                    *time.Time          `json:"split_at,omitempty" bson:"split_at,omitempty"`                                             // Timestamp when split was performed
	AITranslatedAt             *time.Time          `json:"ai_translated_at,omitempty" bson:"ai_translated_at,omitempty"`                             // Timestamp when AI translation was generated
	PrimaryTheme               string              `json:"primary_theme,omitempty" bson:"primary_theme,omitempty"`                                   // Primary theme classification
	SecondaryThemes            []string            `json:"secondary_themes,omitempty" bson:"secondary_themes,omitempty"`                             // Secondary theme classifications
	Rationale                  string              `json:"rationale,omitempty" bson:"rationale,omitempty"`                                           // Rationale for theme classification
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

	// Sort by chapter_sequence_index to preserve interleaved order of verses and prose
	// Fallback to verse_index/prose_index if chapter_sequence_index is missing
	sortOpt := bson.D{
		{Key: "chapter_sequence_index", Value: 1},
		{Key: "verse_index", Value: 1},
		{Key: "prose_index", Value: 1},
	}
	cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(sortOpt))
	if err != nil {
		return nil, fmt.Errorf("failed to query verses for chapter %d: %w", chapterNumber, err)
	}
	defer cursor.Close(ctx)

	var verses []HitopadesaVerse
	if err := cursor.All(ctx, &verses); err != nil {
		return nil, fmt.Errorf("failed to decode verses: %w", err)
	}

	// Infer type if missing and normalize data
	verseCount := 0
	proseCount := 0
	for i := range verses {
		// Infer type from available fields if missing
		if verses[i].Type == "" {
			// First, check _id field (most reliable - format: "verse_X.Y" or "prose_X.Y")
			if verses[i].ID != nil {
				if idStr, ok := verses[i].ID.(string); ok {
					if len(idStr) >= 6 && idStr[:6] == "prose_" {
						verses[i].Type = "prose"
					} else if len(idStr) >= 6 && idStr[:6] == "verse_" {
						verses[i].Type = "verse"
					}
				}
			}

			// If still not set, check verse_number/prose_number
			if verses[i].Type == "" {
				if verses[i].VerseNumber != "" {
					verses[i].Type = "verse"
				} else if verses[i].ProseNumber != "" {
					verses[i].Type = "prose"
				}
			}

			// If still not set, check verse_index vs prose_index
			if verses[i].Type == "" {
				if verses[i].VerseIndex > 0 {
					verses[i].Type = "verse"
				} else if verses[i].ProseIndex > 0 {
					verses[i].Type = "prose"
				} else {
					// Last resort: default to verse
					verses[i].Type = "verse"
				}
			}
		}

		// Count for logging
		if verses[i].Type == "verse" {
			verseCount++
		} else if verses[i].Type == "prose" {
			proseCount++
		}
	}
	log.Printf("GetHitopadesaVerses chapter %d: returned %d items (%d verses, %d prose)", chapterNumber, len(verses), verseCount, proseCount)

	return verses, nil
}

// UpdateHitopadesaVerseTranslation appends a new edited translation to a verse
func UpdateHitopadesaVerseTranslation(verseNumber string, editedTranslation string) error {
	if mongoDB == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	// Parse verse number to get chapter number
	// Format: "chapter.verse" (e.g., "0.1")
	var chapterNumber int
	_, err := fmt.Sscanf(verseNumber, "%d.", &chapterNumber)
	if err != nil {
		return fmt.Errorf("invalid verse number format: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collectionName := fmt.Sprintf("hitopadesa_chapter_%d", chapterNumber)
	collection := mongoDB.Collection(collectionName)

	// Create the edited translation entry with current timestamp
	editedEntry := EditedTranslation{
		Translation: editedTranslation,
		EditedAt:    time.Now(),
	}

	// Use $push to append to the edited_translations array
	filter := bson.M{"verse_number": verseNumber}
	update := bson.M{
		"$push": bson.M{
			"edited_translations": editedEntry,
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update verse translation: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("verse not found: %s", verseNumber)
	}

	return nil
}

// GetPancatantraThemeCounts returns theme frequency counts from intervals
func GetPancatantraThemeCounts() (map[string]int, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Use pancatantra database
	db := getDatabase("pancatantra")
	if db == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection := db.Collection("pancatantra_intervals")

	// Count total documents first
	totalDocs, err := collection.CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("failed to count intervals: %w", err)
	}
	log.Printf("GetPancatantraThemeCounts: found %d total documents in pancatantra_intervals", totalDocs)

	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("failed to query intervals: %w", err)
	}
	defer cursor.Close(ctx)

	themeCounts := make(map[string]int)
	processedDocs := 0
	docsWithThemes := 0
	docsWithoutThemes := 0

	// Iterate through all intervals
	for cursor.Next(ctx) {
		processedDocs++
		var interval bson.M
		if err := cursor.Decode(&interval); err != nil {
			log.Printf("Error decoding interval: %v", err)
			continue
		}

		// Extract interval_themes array
		themes, ok := interval["interval_themes"]
		if !ok {
			docsWithoutThemes++
			continue
		}
		docsWithThemes++

		// Debug: log the type and value of themes (only for first few documents)
		if processedDocs <= 3 {
			log.Printf("Debug: themes type=%T, value=%v", themes, themes)
		}

		// Handle different possible types for themes
		var themesList []interface{}
		switch v := themes.(type) {
		case []interface{}:
			themesList = v
		case []string:
			for _, s := range v {
				themesList = append(themesList, s)
			}
		case bson.A: // MongoDB array type
			themesList = []interface{}(v)
		case nil:
			// Empty or null themes
			continue
		default:
			// Log unexpected type
			if processedDocs <= 3 {
				log.Printf("Debug: unexpected themes type %T, value=%v", v, v)
			}
			continue
		}

		// Debug: log themesList length (only for first few documents)
		if processedDocs <= 3 {
			log.Printf("Debug: themesList length=%d", len(themesList))
		}

		// Count each theme (simple count - each occurrence = 1)
		for i, theme := range themesList {
			// Debug: log theme type and value (only for first document)
			if processedDocs == 1 && i < 3 {
				log.Printf("Debug: theme[%d] type=%T, value=%v", i, theme, theme)
			}

			var themeStr string
			switch v := theme.(type) {
			case string:
				themeStr = v
			case bson.E:
				// Handle BSON element
				if str, ok := v.Value.(string); ok {
					themeStr = str
				} else {
					continue
				}
			default:
				// Try to convert to string
				themeStr = fmt.Sprintf("%v", v)
			}

			// Normalize theme: lowercase and trim spaces
			normalized := strings.ToLower(strings.TrimSpace(themeStr))
			if normalized != "" {
				themeCounts[normalized]++
			}
		}
	}

	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("cursor error: %w", err)
	}

	log.Printf("GetPancatantraThemeCounts: processed %d documents, %d with themes, %d without themes, found %d unique themes",
		processedDocs, docsWithThemes, docsWithoutThemes, len(themeCounts))
	return themeCounts, nil
}

// GetPancatantraChapters returns all chapter metadata
func GetPancatantraChapters() ([]HitopadesaChapterMetadata, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use pancatantra database
	db := getDatabase("pancatantra")
	if db == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}
	collection := db.Collection("pancatantra_chapters")
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

// GetPancatantraVerses returns all verses for a given chapter
func GetPancatantraVerses(chapterNumber int) ([]HitopadesaVerse, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use pancatantra database
	db := getDatabase("pancatantra")
	if db == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}
	collectionName := fmt.Sprintf("pancatantra_chapter_%d", chapterNumber)
	collection := db.Collection(collectionName)

	// Sort by chapter_sequence_index to preserve interleaved order of verses and prose
	// Fallback to verse_index/prose_index if chapter_sequence_index is missing
	sortOpt := bson.D{
		{Key: "chapter_sequence_index", Value: 1},
		{Key: "verse_index", Value: 1},
		{Key: "prose_index", Value: 1},
	}
	cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(sortOpt))
	if err != nil {
		return nil, fmt.Errorf("failed to query verses for chapter %d: %w", chapterNumber, err)
	}
	defer cursor.Close(ctx)

	var verses []HitopadesaVerse
	if err := cursor.All(ctx, &verses); err != nil {
		return nil, fmt.Errorf("failed to decode verses: %w", err)
	}

	// Infer type if missing and normalize data
	verseCount := 0
	proseCount := 0
	for i := range verses {
		// Infer type from available fields if missing
		if verses[i].Type == "" {
			// First, check _id field (most reliable - format: "verse_X.Y" or "prose_X.Y")
			if verses[i].ID != nil {
				if idStr, ok := verses[i].ID.(string); ok {
					if len(idStr) >= 6 && idStr[:6] == "prose_" {
						verses[i].Type = "prose"
					} else if len(idStr) >= 6 && idStr[:6] == "verse_" {
						verses[i].Type = "verse"
					}
				}
			}

			// If still not set, check verse_number/prose_number
			if verses[i].Type == "" {
				if verses[i].VerseNumber != "" {
					verses[i].Type = "verse"
				} else if verses[i].ProseNumber != "" {
					verses[i].Type = "prose"
				}
			}

			// If still not set, check verse_index vs prose_index
			if verses[i].Type == "" {
				if verses[i].VerseIndex > 0 {
					verses[i].Type = "verse"
				} else if verses[i].ProseIndex > 0 {
					verses[i].Type = "prose"
				} else {
					// Last resort: default to verse
					verses[i].Type = "verse"
				}
			}
		}

		// Count for logging
		if verses[i].Type == "verse" {
			verseCount++
		} else if verses[i].Type == "prose" {
			proseCount++
		}
	}
	log.Printf("GetPancatantraVerses chapter %d: returned %d items (%d verses, %d prose)", chapterNumber, len(verses), verseCount, proseCount)

	return verses, nil
}

// UpdatePancatantraVerseTranslation appends a new edited translation to a verse
func UpdatePancatantraVerseTranslation(verseNumber string, editedTranslation string) error {
	if mongoClient == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	// Parse verse number to get chapter number
	// Format: "chapter.verse" (e.g., "0.1")
	var chapterNumber int
	_, err := fmt.Sscanf(verseNumber, "%d.", &chapterNumber)
	if err != nil {
		return fmt.Errorf("invalid verse number format: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use pancatantra database
	db := getDatabase("pancatantra")
	if db == nil {
		return fmt.Errorf("MongoDB not initialized")
	}
	collectionName := fmt.Sprintf("pancatantra_chapter_%d", chapterNumber)
	collection := db.Collection(collectionName)

	// Create the edited translation entry with current timestamp
	editedEntry := EditedTranslation{
		Translation: editedTranslation,
		EditedAt:    time.Now(),
	}

	// Use $push to append to the edited_translations array
	filter := bson.M{"verse_number": verseNumber}
	update := bson.M{
		"$push": bson.M{
			"edited_translations": editedEntry,
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update verse translation: %w", err)
	}

	if result.MatchedCount == 0 {
		// Try prose_number as fallback
		filter = bson.M{"prose_number": verseNumber}
		result, err = collection.UpdateOne(ctx, filter, update)
		if err != nil {
			return fmt.Errorf("failed to update verse translation: %w", err)
		}
		if result.MatchedCount == 0 {
			return fmt.Errorf("verse not found: %s", verseNumber)
		}
	}

	return nil
}

// PancatantraInterval represents an interval document
type PancatantraInterval struct {
	ID              interface{} `bson:"_id"`
	CorpusName      string      `bson:"corpus_name"`
	ChapterNumber   int         `bson:"chapter_number"`
	IntervalIndex   int         `bson:"interval_index"`
	VerseNumbers    []string    `bson:"verse_numbers"`
	ProseNumbers    []string    `bson:"prose_numbers"`
	IntervalSummary string      `bson:"interval_summary"`
	IntervalThemes  []string    `bson:"interval_themes"`
}

// GetPancatantraIntervalByVerse finds the interval containing a given verse or prose number
// Ignores intervals with more than 25 prose shlokas
// itemType should be "verse" or "prose" to search in the appropriate array
func GetPancatantraIntervalByVerse(verseNumber string, itemType string) (*PancatantraInterval, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db := getDatabase("pancatantra")
	if db == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection := db.Collection("pancatantra_intervals")

	// Default to "verse" if type is not provided (backward compatibility)
	if itemType == "" {
		itemType = "verse"
	}

	// Build filter based on item type - search only in the appropriate array
	var typeFilter bson.M
	if itemType == "verse" {
		typeFilter = bson.M{"verse_numbers": verseNumber}
	} else if itemType == "prose" {
		typeFilter = bson.M{"prose_numbers": verseNumber}
	} else {
		return nil, fmt.Errorf("invalid item type: %s (must be 'verse' or 'prose')", itemType)
	}

	// Find interval where the appropriate array contains the verse number
	// and prose_numbers array has at most 25 elements
	filter := bson.M{
		"$and": []bson.M{
			typeFilter,
			{
				"$expr": bson.M{
					"$lte": []interface{}{bson.M{"$size": "$prose_numbers"}, 25},
				},
			},
		},
	}

	var interval PancatantraInterval
	err := collection.FindOne(ctx, filter).Decode(&interval)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // Return nil instead of error when no interval found
		}
		return nil, fmt.Errorf("failed to query interval: %w", err)
	}

	return &interval, nil
}

// GetPancatantraVersesWithContext returns the target verse plus the previous and next verses
func GetPancatantraVersesWithContext(chapterNumber int, verseNumber string) ([]*HitopadesaVerse, error) {
	// Get all verses from the chapter
	allVerses, err := GetPancatantraVerses(chapterNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to get verses: %w", err)
	}

	// Find the index of the target verse
	targetIndex := -1
	for i, verse := range allVerses {
		if verse.VerseNumber == verseNumber || verse.ProseNumber == verseNumber {
			targetIndex = i
			break
		}
	}

	if targetIndex == -1 {
		return nil, fmt.Errorf("verse not found: %s in chapter %d", verseNumber, chapterNumber)
	}

	// Build result array: [previous, target, next]
	result := make([]*HitopadesaVerse, 3)
	result[1] = &allVerses[targetIndex] // target verse

	// Previous verse (if exists)
	if targetIndex > 0 {
		result[0] = &allVerses[targetIndex-1]
	} else {
		result[0] = nil
	}

	// Next verse (if exists)
	if targetIndex < len(allVerses)-1 {
		result[2] = &allVerses[targetIndex+1]
	} else {
		result[2] = nil
	}

	return result, nil
}

// GetBhagavadGitaChapters returns all chapter metadata from the chapters_metadata collection
func GetBhagavadGitaChapters() ([]HitopadesaChapterMetadata, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use bhagavad_gita_shankara_bhasya database
	db := getDatabase("bhagavad_gita_shankara_bhasya")
	if db == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	// Read from chapters_metadata collection
	collection := db.Collection("chapters_metadata")
	sortOpt := bson.D{{Key: "chapter_number", Value: 1}}
	cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(sortOpt))
	if err != nil {
		return nil, fmt.Errorf("failed to query chapters_metadata: %w", err)
	}
	defer cursor.Close(ctx)

	var chapters []HitopadesaChapterMetadata
	if err := cursor.All(ctx, &chapters); err != nil {
		return nil, fmt.Errorf("failed to decode chapters: %w", err)
	}

	return chapters, nil
}

// GetBhagavadGitaVerses returns all items (verses and commentary) for a given chapter
func GetBhagavadGitaVerses(chapterNumber int) ([]HitopadesaVerse, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use bhagavad_gita_shankara_bhasya database
	db := getDatabase("bhagavad_gita_shankara_bhasya")
	if db == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}
	collectionName := fmt.Sprintf("chapter_%d", chapterNumber)
	collection := db.Collection(collectionName)

	// Sort by sequence_number to preserve order
	sortOpt := bson.D{
		{Key: "sequence_number", Value: 1},
	}
	cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(sortOpt))
	if err != nil {
		return nil, fmt.Errorf("failed to query items for chapter %d: %w", chapterNumber, err)
	}
	defer cursor.Close(ctx)

	var verses []HitopadesaVerse
	if err := cursor.All(ctx, &verses); err != nil {
		return nil, fmt.Errorf("failed to decode items: %w", err)
	}

	// Count verses and commentary
	verseCount := 0
	commentaryCount := 0
	for i := range verses {
		// Keep original_verse and commentary types as-is
		if verses[i].Type == "original_verse" {
			verseCount++
		} else if verses[i].Type == "commentary" {
			commentaryCount++
		}
	}
	log.Printf("GetBhagavadGitaVerses chapter %d: returned %d items (%d verses, %d commentary)", chapterNumber, len(verses), verseCount, commentaryCount)

	return verses, nil
}

// UpdateBhagavadGitaVerseTranslation appends a new edited translation to a verse or commentary
func UpdateBhagavadGitaVerseTranslation(verseNumber string, editedTranslation string) error {
	if mongoClient == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	// Parse verse number to get chapter number
	// Format: "chapter.verse" (e.g., "1.1") or "commentary_chapter_sequence"
	var chapterNumber int
	var err error

	// Try to parse as verse number (N.M format)
	_, err = fmt.Sscanf(verseNumber, "%d.", &chapterNumber)
	if err != nil {
		// Try to parse as commentary ID (commentary_N_sequence)
		_, err = fmt.Sscanf(verseNumber, "commentary_%d_", &chapterNumber)
		if err != nil {
			return fmt.Errorf("invalid verse number or ID format: %w", err)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use bhagavad_gita_shankara_bhasya database
	db := getDatabase("bhagavad_gita_shankara_bhasya")
	if db == nil {
		return fmt.Errorf("MongoDB not initialized")
	}
	collectionName := fmt.Sprintf("chapter_%d", chapterNumber)
	collection := db.Collection(collectionName)

	// Create the edited translation entry with current timestamp
	editedEntry := EditedTranslation{
		Translation: editedTranslation,
		EditedAt:    time.Now(),
	}

	// Use $push to append to the edited_translations array
	// Try verse_number first
	filter := bson.M{"verse_number": verseNumber}
	update := bson.M{
		"$push": bson.M{
			"edited_translations": editedEntry,
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update translation: %w", err)
	}

	if result.MatchedCount == 0 {
		// Try _id field as fallback (for commentary)
		filter = bson.M{"_id": verseNumber}
		result, err = collection.UpdateOne(ctx, filter, update)
		if err != nil {
			return fmt.Errorf("failed to update translation: %w", err)
		}
		if result.MatchedCount == 0 {
			return fmt.Errorf("verse or commentary not found: %s", verseNumber)
		}
	}

	return nil
}

// UpdateBhagavadGitaVerseAITranslation updates a verse with AI-generated translation
func UpdateBhagavadGitaVerseAITranslation(verseNumber string, translation string) error {
	if mongoClient == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	// Parse verse number to get chapter number
	// Format: "chapter.verse" (e.g., "1.1") or "commentary_chapter_sequence"
	var chapterNumber int
	var err error

	// Try to parse as verse number (N.M format)
	_, err = fmt.Sscanf(verseNumber, "%d.", &chapterNumber)
	if err != nil {
		// Try to parse as commentary ID (commentary_N_sequence)
		_, err = fmt.Sscanf(verseNumber, "commentary_%d_", &chapterNumber)
		if err != nil {
			return fmt.Errorf("invalid verse number or ID format: %w", err)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use bhagavad_gita_shankara_bhasya database
	db := getDatabase("bhagavad_gita_shankara_bhasya")
	if db == nil {
		return fmt.Errorf("MongoDB not initialized")
	}
	collectionName := fmt.Sprintf("chapter_%d", chapterNumber)
	collection := db.Collection(collectionName)

	now := time.Now()

	// Update with AI translation
	// Store in full_translation field (overwrite if exists)
	filter := bson.M{"verse_number": verseNumber}
	update := bson.M{
		"$set": bson.M{
			"full_translation": translation,
			"ai_translated_at": now,
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update translation: %w", err)
	}

	if result.MatchedCount == 0 {
		// Try _id field as fallback (for commentary)
		filter = bson.M{"_id": verseNumber}
		result, err = collection.UpdateOne(ctx, filter, update)
		if err != nil {
			return fmt.Errorf("failed to update translation: %w", err)
		}
		if result.MatchedCount == 0 {
			return fmt.Errorf("verse or commentary not found: %s", verseNumber)
		}
	}

	return nil
}

// UpdateBhagavadGitaVerseSplit updates a verse with split sandhi results
func UpdateBhagavadGitaVerseSplit(verseNumber string, splitShloka string, splitWordByWord []WordTranslation) error {
	if mongoClient == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	// Parse verse number to get chapter number
	// Format: "chapter.verse" (e.g., "1.1") or "commentary_chapter_sequence"
	var chapterNumber int
	var err error

	// Try to parse as verse number (N.M format)
	_, err = fmt.Sscanf(verseNumber, "%d.", &chapterNumber)
	if err != nil {
		// Try to parse as commentary ID (commentary_N_sequence)
		_, err = fmt.Sscanf(verseNumber, "commentary_%d_", &chapterNumber)
		if err != nil {
			return fmt.Errorf("invalid verse number or ID format: %w", err)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use bhagavad_gita_shankara_bhasya database
	db := getDatabase("bhagavad_gita_shankara_bhasya")
	if db == nil {
		return fmt.Errorf("MongoDB not initialized")
	}
	collectionName := fmt.Sprintf("chapter_%d", chapterNumber)
	collection := db.Collection(collectionName)

	now := time.Now()

	// Update with split results
	filter := bson.M{"verse_number": verseNumber}
	update := bson.M{
		"$set": bson.M{
			"split_shloka":                   splitShloka,
			"split_word_by_word_translation": splitWordByWord,
			"split_at":                       now,
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update split: %w", err)
	}

	if result.MatchedCount == 0 {
		// Try _id field as fallback (for commentary)
		filter = bson.M{"_id": verseNumber}
		result, err = collection.UpdateOne(ctx, filter, update)
		if err != nil {
			return fmt.Errorf("failed to update split: %w", err)
		}
		if result.MatchedCount == 0 {
			return fmt.Errorf("verse or commentary not found: %s", verseNumber)
		}
	}

	return nil
}
