package http

import (
	"chaatra/service"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// RecordingResponse represents the response for recording operations
type RecordingResponse struct {
	AudioURL   string    `json:"audio_url"`
	Duration   float64   `json:"duration"`
	UploadedAt time.Time `json:"uploaded_at"`
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

	// Get storage provider
	storageProvider, err := service.GetStorageProvider()
	if err != nil {
		log.Printf("Error getting storage provider: %v", err)
		http.Error(w, "Storage service not configured", http.StatusInternalServerError)
		return
	}

	// Upload to Cloudinary
	folder := fmt.Sprintf("chaatra/recordings/%s", corpusName)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	audioURL, err := storageProvider.UploadFile(ctx, file, filename, contentType, folder)
	if err != nil {
		log.Printf("Error uploading file to storage: %v", err)
		http.Error(w, fmt.Sprintf("Failed to upload file: %v", err), http.StatusInternalServerError)
		return
	}

	// Extract duration (for now, set to 0 - can be enhanced later with audio metadata parsing)
	duration := 0.0

	// Save recording metadata to verse document
	err = service.SaveRecording(corpusName, verseID, audioURL, duration, userID)
	if err != nil {
		log.Printf("Error saving recording metadata: %v", err)
		// Try to delete uploaded file
		storageProvider.DeleteFile(ctx, audioURL)
		http.Error(w, fmt.Sprintf("Failed to save recording: %v", err), http.StatusInternalServerError)
		return
	}

	// Return success response
	response := RecordingResponse{
		AudioURL:   audioURL,
		Duration:   duration,
		UploadedAt: time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetRecordingHandler returns recording metadata for a verse
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

	// Get recording metadata
	audioURL, duration, exists, err := service.GetRecording(corpusName, verseID)
	if err != nil {
		log.Printf("Error getting recording: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get recording: %v", err), http.StatusInternalServerError)
		return
	}

	if !exists {
		http.Error(w, "Recording not found", http.StatusNotFound)
		return
	}

	// Get uploaded_at timestamp from verse document
	// For now, we'll set it to a default value or fetch it separately if needed
	uploadedAt := time.Now() // TODO: Fetch from verse document if needed

	response := RecordingResponse{
		AudioURL:   audioURL,
		Duration:   duration,
		UploadedAt: uploadedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
