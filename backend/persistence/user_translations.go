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

// HintsUsed represents the hints that were used by the user
type HintsUsed struct {
	RevealedUncompoundedIndices []int `json:"revealed_uncompounded_indices" bson:"revealed_uncompounded_indices"`
	RevealedWordIndices         []int `json:"revealed_word_indices" bson:"revealed_word_indices"`
	FullTranslationShown        bool  `json:"full_translation_shown" bson:"full_translation_shown"`
}

// EvaluationResult represents the result of translation evaluation
type EvaluationResult struct {
	LanguageMastery     string   `json:"language_mastery" bson:"language_mastery"`         // Subjective rating (e.g., "Excellent", "Good", "Fair", "Needs Improvement")
	TranslationFidelity string   `json:"translation_fidelity" bson:"translation_fidelity"` // Subjective rating
	Nuance              string   `json:"nuance" bson:"nuance"`                             // Subjective rating
	Feedback            string   `json:"feedback" bson:"feedback"`
	Strengths           []string `json:"strengths" bson:"strengths"`
	AreasForImprovement []string `json:"areas_for_improvement" bson:"areas_for_improvement"`
}

// UserTranslation represents a user's translation of a verse (supports multiple corpora)
type UserTranslation struct {
	ID               interface{}       `json:"id,omitempty" bson:"_id,omitempty"`
	UserID           interface{}       `json:"user_id" bson:"user_id"`
	CorpusName       string            `json:"corpus_name,omitempty" bson:"corpus_name,omitempty"` // e.g., "bhagavad_gita", "subhashita"
	VerseNumber      string            `json:"verse_number" bson:"verse_number"`
	Translation      string            `json:"translation" bson:"translation"`
	Feedback         string            `json:"feedback,omitempty" bson:"feedback,omitempty"`
	AISuggestions    []string          `json:"ai_suggestions,omitempty" bson:"ai_suggestions,omitempty"`
	HintsUsed        *HintsUsed        `json:"hints_used,omitempty" bson:"hints_used,omitempty"`               // Practice session hints metadata
	EvaluationResult *EvaluationResult `json:"evaluation_result,omitempty" bson:"evaluation_result,omitempty"` // Evaluation ratings and feedback
	CreatedAt        time.Time         `json:"created_at" bson:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at" bson:"updated_at"`
}

// getUserTranslationsCollection returns the user translations collection for a specific user
func getUserTranslationsCollection(userID interface{}) (*mongo.Collection, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	// Convert user ID to string for collection name
	userIDStr := convertUserIDToString(userID)
	collectionName := fmt.Sprintf("user_%s_translations", userIDStr)

	// Use user_translations database (configurable via env var)
	dbName := os.Getenv("MONGODB_USER_TRANSLATIONS_DATABASE")
	if dbName == "" {
		dbName = "user_translations_db" // Default
	}
	translationsDB := mongoClient.Database(dbName)
	collection := translationsDB.Collection(collectionName)

	// Create unique compound index on first access
	// Updated to include corpus_name to allow same verse across different corpora
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexModel := mongo.IndexModel{
		Keys: bson.D{
			{Key: "user_id", Value: 1},
			{Key: "corpus_name", Value: 1},
			{Key: "verse_number", Value: 1},
		},
		Options: options.Index().SetUnique(true),
	}

	_, err := collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		// Index might already exist, log but don't fail
		log.Printf("Note: Could not create unique index on user translations (may already exist): %v", err)
	}

	return collection, nil
}

// CreateUserTranslation creates a new user translation for a subhashita verse
func CreateUserTranslation(userID interface{}, corpusName string, verseNumber string, translation string) (*UserTranslation, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserTranslationsCollection(userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check if translation already exists for this verse
	filter := bson.M{
		"user_id":      userID,
		"corpus_name":  corpusName,
		"verse_number": verseNumber,
	}

	var existing UserTranslation
	err = collection.FindOne(ctx, filter).Decode(&existing)
	if err == nil {
		// Translation exists, update it
		// Preserve existing feedback and suggestions if not provided
		updateSet := bson.M{
			"translation": translation,
			"corpus_name": corpusName, // Update corpus_name in case it was missing
			"updated_at":  time.Now(),
		}

		// Only update feedback/suggestions if they're being explicitly set (not empty)
		// This preserves existing feedback/suggestions if not provided in the update
		update := bson.M{
			"$set": updateSet,
		}

		result, err := collection.UpdateOne(ctx, filter, update)
		if err != nil {
			return nil, fmt.Errorf("failed to update user translation: %w", err)
		}

		if result.MatchedCount == 0 {
			return nil, fmt.Errorf("translation not found")
		}

		// Retrieve updated translation
		var updated UserTranslation
		err = collection.FindOne(ctx, filter).Decode(&updated)
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve updated translation: %w", err)
		}

		log.Printf("Updated user translation for verse %s, user: %v", verseNumber, userID)
		return &updated, nil
	} else if err != mongo.ErrNoDocuments {
		return nil, fmt.Errorf("failed to check existing translation: %w", err)
	}

	// Create new translation
	userTranslation := &UserTranslation{
		UserID:      userID,
		CorpusName:  corpusName,
		VerseNumber: verseNumber,
		Translation: translation,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	result, err := collection.InsertOne(ctx, userTranslation)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			// Race condition - try to update instead
			return CreateUserTranslation(userID, corpusName, verseNumber, translation)
		}
		return nil, fmt.Errorf("failed to create user translation: %w", err)
	}

	userTranslation.ID = result.InsertedID
	log.Printf("Created user translation with ID: %v for verse %s, user: %v", result.InsertedID, verseNumber, userID)

	return userTranslation, nil
}

// CreateUserTranslationWithFeedback creates or updates a user translation with feedback and suggestions
func CreateUserTranslationWithFeedback(userID interface{}, corpusName string, verseNumber string, translation string, feedback string, suggestions []string) (*UserTranslation, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserTranslationsCollection(userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check if translation already exists for this verse
	filter := bson.M{
		"user_id":      userID,
		"corpus_name":  corpusName,
		"verse_number": verseNumber,
	}

	var existing UserTranslation
	err = collection.FindOne(ctx, filter).Decode(&existing)
	if err == nil {
		// Translation exists, update it
		updateSet := bson.M{
			"translation": translation,
			"corpus_name": corpusName, // Update corpus_name in case it was missing
			"updated_at":  time.Now(),
		}

		// Update feedback and suggestions if provided
		if feedback != "" {
			updateSet["feedback"] = feedback
		}
		if len(suggestions) > 0 {
			updateSet["ai_suggestions"] = suggestions
		}

		update := bson.M{
			"$set": updateSet,
		}

		result, err := collection.UpdateOne(ctx, filter, update)
		if err != nil {
			return nil, fmt.Errorf("failed to update user translation: %w", err)
		}

		if result.MatchedCount == 0 {
			return nil, fmt.Errorf("translation not found")
		}

		// Retrieve updated translation
		var updated UserTranslation
		err = collection.FindOne(ctx, filter).Decode(&updated)
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve updated translation: %w", err)
		}

		log.Printf("Updated user translation for verse %s, user: %v", verseNumber, userID)
		return &updated, nil
	} else if err != mongo.ErrNoDocuments {
		return nil, fmt.Errorf("failed to check existing translation: %w", err)
	}

	// Create new translation
	userTranslation := &UserTranslation{
		UserID:        userID,
		CorpusName:    corpusName,
		VerseNumber:   verseNumber,
		Translation:   translation,
		Feedback:      feedback,
		AISuggestions: suggestions,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	result, err := collection.InsertOne(ctx, userTranslation)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			// Race condition - try to update instead
			return CreateUserTranslationWithFeedback(userID, corpusName, verseNumber, translation, feedback, suggestions)
		}
		return nil, fmt.Errorf("failed to create user translation: %w", err)
	}

	userTranslation.ID = result.InsertedID
	log.Printf("Created user translation with ID: %v for verse %s, user: %v", result.InsertedID, verseNumber, userID)

	return userTranslation, nil
}

// GetUserTranslation retrieves a user's translation for a specific verse
func GetUserTranslation(userID interface{}, verseNumber string) (*UserTranslation, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserTranslationsCollection(userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"user_id":      userID,
		"verse_number": verseNumber,
	}

	var translation UserTranslation
	err = collection.FindOne(ctx, filter).Decode(&translation)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // Translation not found
		}
		return nil, fmt.Errorf("failed to query user translation: %w", err)
	}

	return &translation, nil
}

// GetUserTranslations retrieves all user translations for a user, optionally filtered by verse number
func GetUserTranslations(userID interface{}, verseNumber string) ([]UserTranslation, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserTranslationsCollection(userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"user_id": userID}
	if verseNumber != "" {
		filter["verse_number"] = verseNumber
	}

	// Sort by updated_at descending (newest first)
	sortOpt := bson.D{{Key: "updated_at", Value: -1}}
	cursor, err := collection.Find(ctx, filter, options.Find().SetSort(sortOpt))
	if err != nil {
		return nil, fmt.Errorf("failed to query user translations: %w", err)
	}
	defer cursor.Close(ctx)

	var translations []UserTranslation
	if err := cursor.All(ctx, &translations); err != nil {
		return nil, fmt.Errorf("failed to decode user translations: %w", err)
	}

	return translations, nil
}

// UpdateUserTranslationAISuggestions updates the AI suggestions for a user translation
func UpdateUserTranslationAISuggestions(userID interface{}, verseNumber string, suggestions []string) error {
	if mongoClient == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserTranslationsCollection(userID)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"user_id":      userID,
		"verse_number": verseNumber,
	}

	update := bson.M{
		"$set": bson.M{
			"ai_suggestions": suggestions,
			"updated_at":     time.Now(),
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update AI suggestions: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("user translation not found")
	}

	log.Printf("Updated AI suggestions for verse %s, user: %v", verseNumber, userID)
	return nil
}

// UpdateUserTranslationFeedback updates the feedback and AI suggestions for a user translation
func UpdateUserTranslationFeedback(userID interface{}, verseNumber string, feedback string, suggestions []string) error {
	if mongoClient == nil {
		return fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserTranslationsCollection(userID)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"user_id":      userID,
		"verse_number": verseNumber,
	}

	update := bson.M{
		"$set": bson.M{
			"feedback":       feedback,
			"ai_suggestions": suggestions,
			"updated_at":     time.Now(),
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update feedback and suggestions: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("user translation not found")
	}

	log.Printf("Updated feedback and suggestions for verse %s, user: %v", verseNumber, userID)
	return nil
}

// CreatePracticeSession creates or updates a translation practice session
// This includes the user's translation, hints used, and evaluation results
func CreatePracticeSession(userID interface{}, corpusName string, shlokaID string, translation string, hintsUsed *HintsUsed, evaluationResult *EvaluationResult) (*UserTranslation, error) {
	if mongoClient == nil {
		return nil, fmt.Errorf("MongoDB not initialized")
	}

	collection, err := getUserTranslationsCollection(userID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check if practice session already exists
	filter := bson.M{
		"user_id":      userID,
		"corpus_name":  corpusName,
		"verse_number": shlokaID,
	}

	var existing UserTranslation
	err = collection.FindOne(ctx, filter).Decode(&existing)
	if err == nil {
		// Practice session exists, update it
		updateSet := bson.M{
			"translation": translation,
			"updated_at":  time.Now(),
		}

		// Update hints used if provided
		if hintsUsed != nil {
			updateSet["hints_used"] = hintsUsed
		}

		// Update evaluation result if provided
		if evaluationResult != nil {
			updateSet["evaluation_result"] = evaluationResult
		}

		update := bson.M{
			"$set": updateSet,
		}

		result, err := collection.UpdateOne(ctx, filter, update)
		if err != nil {
			return nil, fmt.Errorf("failed to update practice session: %w", err)
		}

		if result.MatchedCount == 0 {
			return nil, fmt.Errorf("practice session not found")
		}

		// Retrieve updated practice session
		var updated UserTranslation
		err = collection.FindOne(ctx, filter).Decode(&updated)
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve updated practice session: %w", err)
		}

		log.Printf("Updated practice session for corpus %s, verse %s, user: %v", corpusName, shlokaID, userID)
		return &updated, nil
	} else if err != mongo.ErrNoDocuments {
		return nil, fmt.Errorf("failed to check existing practice session: %w", err)
	}

	// Create new practice session
	practiceSession := &UserTranslation{
		UserID:           userID,
		CorpusName:       corpusName,
		VerseNumber:      shlokaID,
		Translation:      translation,
		HintsUsed:        hintsUsed,
		EvaluationResult: evaluationResult,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	result, err := collection.InsertOne(ctx, practiceSession)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			// Race condition - try to update instead
			return CreatePracticeSession(userID, corpusName, shlokaID, translation, hintsUsed, evaluationResult)
		}
		return nil, fmt.Errorf("failed to create practice session: %w", err)
	}

	practiceSession.ID = result.InsertedID
	log.Printf("Created practice session with ID: %v for corpus %s, verse %s, user: %v", result.InsertedID, corpusName, shlokaID, userID)

	return practiceSession, nil
}
