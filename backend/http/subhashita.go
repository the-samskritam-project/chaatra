package http

import (
	"chaatra/persistence"
	"chaatra/service"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

// SubhashitaThemesHandler returns the list of LLM-classified primary
// themes with the count of enriched subhashitas per theme, sorted by
// descending count. Optional ?min=<n> filters out long-tail themes
// with fewer than n verses (default 5).
func SubhashitaThemesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	minCount := 5
	if v := r.URL.Query().Get("min"); v != "" {
		var parsed int
		if _, err := fmt.Sscanf(v, "%d", &parsed); err == nil && parsed >= 0 {
			minCount = parsed
		}
	}

	themes, err := persistence.GetSubhashitaThemes(minCount)
	if err != nil {
		log.Printf("Error getting subhashita themes: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get themes: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(themes)
}

// SubhashitaByThemeHandler returns every enriched subhashita whose
// primary_theme matches the ?theme=<name> query, sorted by verse_number.
// Optional ?limit=<n> caps the response size.
func SubhashitaByThemeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	theme := strings.TrimSpace(r.URL.Query().Get("theme"))
	if theme == "" {
		http.Error(w, "theme query parameter is required", http.StatusBadRequest)
		return
	}

	limit := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		var parsed int
		if _, err := fmt.Sscanf(v, "%d", &parsed); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	verses, err := persistence.GetSubhashitasByTheme(theme, limit)
	if err != nil {
		log.Printf("Error getting subhashitas by theme %q: %v", theme, err)
		http.Error(w, fmt.Sprintf("Failed to get subhashitas: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(verses)
}

// SubhashitaRandomHandler returns a random subhashita verse or a specific verse if verse_number is provided
func SubhashitaRandomHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check if verse_number query parameter is provided
	verseNumber := r.URL.Query().Get("verse_number")

	var verse *persistence.SubhashitaVerse
	var err error

	if verseNumber != "" {
		// Get specific verse
		verse, err = persistence.GetSubhashitaByVerseNumber(verseNumber)
		if err != nil {
			log.Printf("Error getting subhashita verse %s: %v", verseNumber, err)
			http.Error(w, fmt.Sprintf("Failed to get verse: %v", err), http.StatusNotFound)
			return
		}
	} else {
		// Get random verse
		verse, err = persistence.GetRandomSubhashita()
		if err != nil {
			log.Printf("Error getting random subhashita: %v", err)
			http.Error(w, fmt.Sprintf("Failed to get random subhashita: %v", err), http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(verse)
}

// SubhashitaSplitHandler returns or generates word splits and word-by-word translation for a subhashita verse
func SubhashitaSplitHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Expected format: /subhashita/{verse_number}/split
	path := strings.TrimPrefix(r.URL.Path, "/subhashita/")
	path = strings.TrimSuffix(path, "/split")
	verseNumber := strings.TrimSpace(path)

	if verseNumber == "" {
		http.Error(w, "verse number is required in URL path", http.StatusBadRequest)
		return
	}

	// First, check if the verse already has splits stored
	verse, err := persistence.GetSubhashitaByVerseNumber(verseNumber)
	if err != nil {
		log.Printf("Error getting subhashita verse %s: %v", verseNumber, err)
		http.Error(w, fmt.Sprintf("Failed to get verse: %v", err), http.StatusNotFound)
		return
	}

	// If splits already exist, return them directly
	if verse.SplitShloka != "" && len(verse.SplitWordByWordTranslation) > 0 {
		log.Printf("Returning cached splits for verse %s", verseNumber)
		response := map[string]interface{}{
			"uncompounded_shloka":      verse.SplitShloka,
			"word_by_word_translation": verse.SplitWordByWordTranslation,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// If splits don't exist, generate them using AI
	ctx := context.Background()
	splitResult, err := service.SplitSandhi(ctx, verse.TransliteratedDevanagari, verseNumber)
	if err != nil {
		log.Printf("Error splitting subhashita verse %s: %v", verseNumber, err)
		http.Error(w, fmt.Sprintf("Failed to split verse: %v", err), http.StatusInternalServerError)
		return
	}

	// Store the results in the verse document for future use
	err = persistence.UpdateSubhashitaSplit(verseNumber, splitResult.UncompoundedShloka, splitResult.WordByWordTranslation)
	if err != nil {
		log.Printf("Error storing split for verse %s: %v", verseNumber, err)
		// Continue anyway - we'll return the result even if storage fails
	}

	// Return the split result
	response := map[string]interface{}{
		"uncompounded_shloka":      splitResult.UncompoundedShloka,
		"word_by_word_translation": splitResult.WordByWordTranslation,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// SubhashitaSaveTranslationHandler saves a user's translation for a subhashita verse
func SubhashitaSaveTranslationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context (requires JWT auth middleware)
	userID, ok := GetUserIDFromContext(r)
	if !ok {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	// Expected format: /subhashita/{verse_number}/translation
	path := strings.TrimPrefix(r.URL.Path, "/subhashita/")
	path = strings.TrimSuffix(path, "/translation")
	verseNumber := strings.TrimSpace(path)

	if verseNumber == "" {
		http.Error(w, "verse number is required in URL path", http.StatusBadRequest)
		return
	}

	// Parse request body
	var req struct {
		Translation   string   `json:"user_translation"`
		Feedback      string   `json:"feedback,omitempty"`
		AISuggestions []string `json:"ai_suggestions,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if req.Translation == "" {
		http.Error(w, "user_translation is required", http.StatusBadRequest)
		return
	}

	// Save the translation
	userTranslation, err := persistence.CreateUserTranslationWithFeedback(userID, "subhashita", verseNumber, req.Translation, req.Feedback, req.AISuggestions)
	if err != nil {
		log.Printf("Error saving user translation for verse %s: %v", verseNumber, err)
		http.Error(w, fmt.Sprintf("Failed to save translation: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userTranslation)
}

// SubhashitaVerifyTranslationHandler verifies a user's translation using AI
func SubhashitaVerifyTranslationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Expected format: /subhashita/{verse_number}/verify
	path := strings.TrimPrefix(r.URL.Path, "/subhashita/")
	path = strings.TrimSuffix(path, "/verify")
	verseNumber := strings.TrimSpace(path)

	if verseNumber == "" {
		http.Error(w, "verse number is required in URL path", http.StatusBadRequest)
		return
	}

	// Parse request body
	var req struct {
		UserTranslation string `json:"user_translation"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Get the verse to get the Devanagari text
	verse, err := persistence.GetSubhashitaByVerseNumber(verseNumber)
	if err != nil {
		log.Printf("Error getting subhashita verse %s: %v", verseNumber, err)
		http.Error(w, fmt.Sprintf("Failed to get verse: %v", err), http.StatusNotFound)
		return
	}

	ctx := context.Background()

	// If user translation is empty, generate one using AI
	if req.UserTranslation == "" || strings.TrimSpace(req.UserTranslation) == "" {
		translation, err := service.GenerateTranslation(ctx, verse.TransliteratedDevanagari, verseNumber)
		if err != nil {
			log.Printf("Error generating translation for verse %s: %v", verseNumber, err)
			http.Error(w, fmt.Sprintf("Failed to generate translation: %v", err), http.StatusInternalServerError)
			return
		}

		response := map[string]interface{}{
			"generated_translation": translation,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Verify the translation using AI
	verificationResult, err := service.VerifySubhashitaTranslation(ctx, verse.TransliteratedDevanagari, req.UserTranslation, verseNumber)
	if err != nil {
		log.Printf("Error verifying translation for verse %s: %v", verseNumber, err)
		http.Error(w, fmt.Sprintf("Failed to verify translation: %v", err), http.StatusInternalServerError)
		return
	}

	// Optionally extract user ID from Authorization header if present (for saving suggestions)
	var userID interface{}
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			claims, err := service.ValidateToken(parts[1])
			if err == nil {
				userID = claims.UserID
			}
		}
	}

	// If user is authenticated, save feedback and suggestions to the user translation document
	if userID != nil {
		// Try to update feedback and AI suggestions (don't fail if translation doesn't exist yet)
		err := persistence.UpdateUserTranslationFeedback(userID, verseNumber, verificationResult.Feedback, verificationResult.Suggestions)
		if err != nil {
			// Log but don't fail - feedback and suggestions are optional
			log.Printf("Note: Could not save feedback and suggestions for verse %s: %v", verseNumber, err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(verificationResult)
}

// SubhashitaGetTranslationHandler retrieves a user's saved translation for a verse
func SubhashitaGetTranslationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context (requires JWT auth middleware)
	userID, ok := GetUserIDFromContext(r)
	if !ok {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	// Expected format: /subhashita/{verse_number}/translation
	path := strings.TrimPrefix(r.URL.Path, "/subhashita/")
	path = strings.TrimSuffix(path, "/translation")
	verseNumber := strings.TrimSpace(path)

	if verseNumber == "" {
		http.Error(w, "verse number is required in URL path", http.StatusBadRequest)
		return
	}

	// Get the saved translation
	userTranslation, err := persistence.GetUserTranslation(userID, verseNumber)
	if err != nil {
		log.Printf("Error getting user translation for verse %s: %v", verseNumber, err)
		http.Error(w, fmt.Sprintf("Failed to get translation: %v", err), http.StatusInternalServerError)
		return
	}

	if userTranslation == nil {
		// No translation found
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userTranslation)
}

// SubhashitaGetAllTranslationsHandler retrieves all user's saved translations
func SubhashitaGetAllTranslationsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context (requires JWT auth middleware)
	userID, ok := GetUserIDFromContext(r)
	if !ok {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	// Get all translations for the user
	translations, err := persistence.GetUserTranslations(userID, "")
	if err != nil {
		log.Printf("Error getting user translations: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get translations: %v", err), http.StatusInternalServerError)
		return
	}

	// Fetch verse details for each translation
	type TranslationWithVerse struct {
		persistence.UserTranslation
		Verse *persistence.SubhashitaVerse `json:"verse,omitempty"`
	}

	translationsWithVerses := make([]TranslationWithVerse, 0, len(translations))
	for _, translation := range translations {
		verse, err := persistence.GetSubhashitaByVerseNumber(translation.VerseNumber)
		if err != nil {
			log.Printf("Error getting verse %s: %v", translation.VerseNumber, err)
			// Continue without verse details
			translationsWithVerses = append(translationsWithVerses, TranslationWithVerse{
				UserTranslation: translation,
			})
		} else {
			translationsWithVerses = append(translationsWithVerses, TranslationWithVerse{
				UserTranslation: translation,
				Verse:           verse,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(translationsWithVerses)
}
