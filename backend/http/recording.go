package http

import (
	"bytes"
	"chaatra/persistence"
	"chaatra/service"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// RecordingResponse represents the response for recording operations
type RecordingResponse struct {
	Transcription string      `json:"transcription"`     // Devanagari transcription
	UploadedAt    time.Time   `json:"uploaded_at"`       // When transcription was created
	NoteID        interface{} `json:"note_id,omitempty"` // ID of created note
}

// UploadRecordingHandler handles audio file uploads for verses
// POST /v2/{corpus}/verses/{id}/recording
func UploadRecordingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract corpus and verse ID from URL path
	// Path format: /v2/{corpus}/verses/{id}/recording
	path := r.URL.Path
	pathParts := strings.Split(strings.TrimPrefix(path, "/v2/"), "/")

	if len(pathParts) < 4 || pathParts[1] != "verses" || pathParts[3] != "recording" {
		http.Error(w, "Invalid URL format. Expected: /v2/{corpus}/verses/{id}/recording", http.StatusBadRequest)
		return
	}

	corpusName := pathParts[0]
	verseID := pathParts[2]

	// Get user ID from context (set by JWTAuthMiddleware)
	userID, ok := GetUserIDFromContext(r)
	if !ok {
		http.Error(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	// Parse multipart form (max 10MB)
	err := r.ParseMultipartForm(10 << 20) // 10 MB
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse multipart form: %v", err), http.StatusBadRequest)
		return
	}

	// Get file from form
	file, handler, err := r.FormFile("audio")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get file from form: %v", err), http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file
	filename := handler.Filename
	contentType := handler.Header.Get("Content-Type")

	if err := service.ValidateAudioFile(filename, contentType); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Check file size (10MB limit)
	if handler.Size > 10<<20 {
		http.Error(w, "File size exceeds 10MB limit", http.StatusBadRequest)
		return
	}

	// Read audio file into memory for transcription
	audioData, err := io.ReadAll(file)
	if err != nil {
		log.Printf("Error reading audio file: %v", err)
		http.Error(w, fmt.Sprintf("Failed to read audio file: %v", err), http.StatusInternalServerError)
		return
	}

	// Log file size for debugging
	fileSizeMB := float64(len(audioData)) / (1024 * 1024)
	log.Printf("Transcribing audio file: %s, size: %.2f MB", filename, fileSizeMB)

	// Validate file size (10MB limit) - check actual data size
	if int64(len(audioData)) > 10<<20 {
		http.Error(w, "File size exceeds 10MB limit", http.StatusBadRequest)
		return
	}

	// Transcribe audio using Whisper
	// Pass the audio data directly as bytes.Reader
	audioReader := bytes.NewReader(audioData)
	log.Printf("Starting Whisper transcription for file: %s", filename)
	iastTranscription, err := service.TranscribeAudio(audioReader, filename)
	if err != nil {
		log.Printf("Error transcribing audio: %v", err)
		http.Error(w, fmt.Sprintf("Failed to transcribe audio: %v", err), http.StatusInternalServerError)
		return
	}
	log.Printf("Successfully transcribed audio, length: %d characters", len(iastTranscription))

	// Convert IAST to Devanagari
	devanagariTranscription := service.ConvertIASTToDevanagari(iastTranscription)

	// Create note with transcription
	note := &persistence.Note{
		CorpusName:   corpusName,
		CorpusUnit:   "Verse",
		CorpusUnitID: verseID,
		Content:      devanagariTranscription,
		MediaType:    "voice_note",
	}

	createdNote, err := persistence.CreateNote(userID, note)
	if err != nil {
		log.Printf("Error creating note: %v", err)
		http.Error(w, fmt.Sprintf("Failed to create note: %v", err), http.StatusInternalServerError)
		return
	}

	// Return success response
	response := RecordingResponse{
		Transcription: devanagariTranscription,
		UploadedAt:    time.Now(),
		NoteID:        createdNote.ID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetRecordingHandler returns recording transcription for a verse (from notes)
// GET /v2/{corpus}/verses/{id}/recording
func GetRecordingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract corpus and verse ID from URL path
	path := r.URL.Path
	pathParts := strings.Split(strings.TrimPrefix(path, "/v2/"), "/")

	if len(pathParts) < 4 || pathParts[1] != "verses" || pathParts[3] != "recording" {
		http.Error(w, "Invalid URL format. Expected: /v2/{corpus}/verses/{id}/recording", http.StatusBadRequest)
		return
	}

	corpusName := pathParts[0]
	verseID := pathParts[2]

	// Get user ID from context (set by JWTAuthMiddleware if authenticated)
	userID, ok := GetUserIDFromContext(r)
	if !ok {
		http.Error(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	// Get notes for this verse with voice_note media type
	filters := &persistence.NoteFilters{
		CorpusName:   corpusName,
		CorpusUnit:   "Verse",
		CorpusUnitID: verseID,
	}

	notes, err := persistence.GetNotes(userID, filters)
	if err != nil {
		log.Printf("Error getting notes: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get notes: %v", err), http.StatusInternalServerError)
		return
	}

	// Find the most recent voice note
	var voiceNote *persistence.Note
	for i := range notes {
		if notes[i].MediaType == "voice_note" {
			voiceNote = &notes[i]
			break
		}
	}

	if voiceNote == nil {
		http.Error(w, "Recording transcription not found", http.StatusNotFound)
		return
	}

	response := RecordingResponse{
		Transcription: voiceNote.Content,
		UploadedAt:    voiceNote.CreatedAt,
		NoteID:        voiceNote.ID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
