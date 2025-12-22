package http

import (
	"chaatra/persistence"
	"chaatra/service"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

// CreateNoteRequest represents the request body for creating a note
type CreateNoteRequest struct {
	CorpusName   string `json:"corpus_name"`
	CorpusUnit   string `json:"corpus_unit"`
	CorpusUnitID string `json:"corpus_unit_id"`
	Content      string `json:"content"`
}

// UpdateNoteRequest represents the request body for updating a note
type UpdateNoteRequest struct {
	Content string `json:"content"`
}

// CreateNoteHandler handles creating a new note
func CreateNoteHandler(w http.ResponseWriter, r *http.Request) {
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

	var req CreateNoteRequest
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
	if req.Content == "" {
		http.Error(w, "content is required", http.StatusBadRequest)
		return
	}

	// Validate corpus name
	if err := service.ValidateCorpusName(req.CorpusName); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate corpus unit
	if err := service.ValidateCorpusUnit(req.CorpusUnit); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate corpus unit ID
	if err := service.ValidateCorpusUnitID(req.CorpusUnit, req.CorpusUnitID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Create note
	note := &persistence.Note{
		CorpusName:   req.CorpusName,
		CorpusUnit:   req.CorpusUnit,
		CorpusUnitID: req.CorpusUnitID,
		Content:      req.Content,
	}

	createdNote, err := persistence.CreateNote(userID, note)
	if err != nil {
		log.Printf("Error creating note: %v", err)
		http.Error(w, fmt.Sprintf("Failed to create note: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdNote)
}

// GetNotesHandler handles retrieving notes with optional filters
func GetNotesHandler(w http.ResponseWriter, r *http.Request) {
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
	filters := &persistence.NoteFilters{
		CorpusName:   r.URL.Query().Get("corpus_name"),
		CorpusUnit:   r.URL.Query().Get("corpus_unit"),
		CorpusUnitID: r.URL.Query().Get("corpus_unit_id"),
	}

	// Get notes
	notes, err := persistence.GetNotes(userID, filters)
	if err != nil {
		log.Printf("Error getting notes: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get notes: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notes)
}

// GetNoteHandler handles retrieving a single note by ID
func GetNoteHandler(w http.ResponseWriter, r *http.Request) {
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

	// Extract note ID from URL path
	// Path format: /v2/notes/{id}
	path := strings.TrimPrefix(r.URL.Path, "/v2/notes/")
	if path == "" || path == r.URL.Path {
		http.Error(w, "Note ID is required", http.StatusBadRequest)
		return
	}

	noteID := path

	// Get note
	note, err := persistence.GetNoteByID(userID, noteID)
	if err != nil {
		log.Printf("Error getting note: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get note: %v", err), http.StatusInternalServerError)
		return
	}

	if note == nil {
		http.Error(w, "Note not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(note)
}

// UpdateNoteHandler handles updating a note's content
func UpdateNoteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context
	userID, ok := GetUserIDFromContext(r)
	if !ok {
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
		return
	}

	// Extract note ID from URL path
	// Path format: /v2/notes/{id}
	path := strings.TrimPrefix(r.URL.Path, "/v2/notes/")
	if path == "" || path == r.URL.Path {
		http.Error(w, "Note ID is required", http.StatusBadRequest)
		return
	}

	noteID := path

	var req UpdateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		http.Error(w, "content is required", http.StatusBadRequest)
		return
	}

	// Update note
	updatedNote, err := persistence.UpdateNote(userID, noteID, req.Content)
	if err != nil {
		if err.Error() == "note not found or does not belong to user" {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		log.Printf("Error updating note: %v", err)
		http.Error(w, fmt.Sprintf("Failed to update note: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedNote)
}
