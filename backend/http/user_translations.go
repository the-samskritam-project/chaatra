package http

import (
	"chaatra/persistence"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

// GetTranslationsHandler handles retrieving all user translations/practice sessions
func GetTranslationsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context
	userID, ok := GetUserIDFromContext(r)
	if !ok {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	// Get all translations for the user (pass empty string to get all)
	translations, err := persistence.GetUserTranslations(userID, "")
	if err != nil {
		log.Printf("Error getting user translations: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get translations: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(translations)
}

