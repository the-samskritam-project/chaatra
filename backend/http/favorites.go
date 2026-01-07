package http

import (
	"chaatra/persistence"
	"chaatra/service"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

// StarVerseRequest represents the request body for starring a verse
type StarVerseRequest struct {
	CorpusName   string `json:"corpus_name"`
	CorpusUnit   string `json:"corpus_unit"`
	CorpusUnitID string `json:"corpus_unit_id"`
}

// FavoriteStatusResponse represents the response for favorite status check
type FavoriteStatusResponse struct {
	IsFavorite bool `json:"is_favorite"`
}

// StarVerseHandler handles starring a verse
func StarVerseHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context
	userID, ok := GetUserIDFromContext(r)
	if !ok {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	var req StarVerseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.CorpusName == "" {
		http.Error(w, "corpus_name is required", http.StatusBadRequest)
		return
	}
	if req.CorpusUnit == "" {
		http.Error(w, "corpus_unit is required", http.StatusBadRequest)
		return
	}
	if req.CorpusUnitID == "" {
		http.Error(w, "corpus_unit_id is required", http.StatusBadRequest)
		return
	}

	// Validate corpus name
	if err := service.ValidateCorpusNameForFavorite(req.CorpusName); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate corpus unit
	if err := service.ValidateCorpusUnitForFavorite(req.CorpusUnit); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate corpus unit ID
	if err := service.ValidateCorpusUnitIDForFavorite(req.CorpusName, req.CorpusUnit, req.CorpusUnitID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Create favorite
	favorite := &persistence.Favorite{
		CorpusName:   req.CorpusName,
		CorpusUnit:   req.CorpusUnit,
		CorpusUnitID: req.CorpusUnitID,
	}

	createdFavorite, err := persistence.CreateFavorite(userID, favorite)
	if err != nil {
		if err.Error() == "verse is already favorited" {
			// Return the existing favorite instead of error
			existingFavorite, getErr := persistence.GetFavorite(userID, req.CorpusName, req.CorpusUnit, req.CorpusUnitID)
			if getErr != nil {
				log.Printf("Error getting existing favorite: %v", getErr)
				http.Error(w, "Verse is already favorited", http.StatusConflict)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(existingFavorite)
			return
		}
		log.Printf("Error creating favorite: %v", err)
		http.Error(w, fmt.Sprintf("Failed to create favorite: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdFavorite)
}

// UnstarVerseHandler handles unstarring a verse
func UnstarVerseHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context
	userID, ok := GetUserIDFromContext(r)
	if !ok {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	// Parse query parameters
	corpusName := r.URL.Query().Get("corpus_name")
	corpusUnit := r.URL.Query().Get("corpus_unit")
	corpusUnitID := r.URL.Query().Get("corpus_unit_id")

	if corpusName == "" || corpusUnit == "" || corpusUnitID == "" {
		http.Error(w, "corpus_name, corpus_unit, and corpus_unit_id are required as query parameters", http.StatusBadRequest)
		return
	}

	// Delete favorite
	err := persistence.DeleteFavorite(userID, corpusName, corpusUnit, corpusUnitID)
	if err != nil {
		if err.Error() == "favorite not found" {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		log.Printf("Error deleting favorite: %v", err)
		http.Error(w, fmt.Sprintf("Failed to delete favorite: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Favorite removed successfully"})
}

// GetFavoriteStatusHandler handles checking if a verse is favorited
func GetFavoriteStatusHandler(w http.ResponseWriter, r *http.Request) {
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

	// Parse query parameters
	corpusName := r.URL.Query().Get("corpus_name")
	corpusUnit := r.URL.Query().Get("corpus_unit")
	corpusUnitID := r.URL.Query().Get("corpus_unit_id")

	if corpusName == "" || corpusUnit == "" || corpusUnitID == "" {
		http.Error(w, "corpus_name, corpus_unit, and corpus_unit_id are required as query parameters", http.StatusBadRequest)
		return
	}

	// Get favorite
	favorite, err := persistence.GetFavorite(userID, corpusName, corpusUnit, corpusUnitID)
	if err != nil {
		log.Printf("Error getting favorite: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get favorite status: %v", err), http.StatusInternalServerError)
		return
	}

	response := FavoriteStatusResponse{
		IsFavorite: favorite != nil,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetFavoritesHandler handles retrieving favorites with optional filters
func GetFavoritesHandler(w http.ResponseWriter, r *http.Request) {
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

	// Parse query parameters
	filters := &persistence.FavoriteFilters{
		CorpusName: r.URL.Query().Get("corpus_name"),
		CorpusUnit: r.URL.Query().Get("corpus_unit"),
	}

	// Get favorites
	favorites, err := persistence.GetFavorites(userID, filters)
	if err != nil {
		log.Printf("Error getting favorites: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get favorites: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(favorites)
}

