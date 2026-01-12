package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"
)

// WhisperResponse represents the response from OpenAI Whisper API
type WhisperResponse struct {
	Text string `json:"text"`
}

// TranscribeAudio transcribes an audio file using OpenAI Whisper API
// Returns the transcription text in IAST format (or whatever format Whisper returns)
func TranscribeAudio(audioFile io.Reader, filename string) (string, error) {
	log.Printf("[Whisper] Starting transcription for file: %s", filename)

	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}
	log.Printf("[Whisper] API key found, length: %d", len(apiKey))

	// Create a buffer to store the multipart form data
	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)
	log.Printf("[Whisper] Created multipart writer with boundary: %s", writer.Boundary())

	// Add the file field
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		log.Printf("[Whisper] ERROR: Failed to create form file: %v", err)
		return "", fmt.Errorf("failed to create form file: %w", err)
	}
	log.Printf("[Whisper] Created form file part for: %s", filename)

	// Copy audio file data to the form
	bytesCopied, err := io.Copy(part, audioFile)
	if err != nil {
		log.Printf("[Whisper] ERROR: Failed to copy audio data: %v", err)
		return "", fmt.Errorf("failed to copy audio data: %w", err)
	}
	log.Printf("[Whisper] Copied %d bytes of audio data to multipart form", bytesCopied)

	// Add the model field (Whisper model)
	err = writer.WriteField("model", "whisper-1")
	if err != nil {
		log.Printf("[Whisper] ERROR: Failed to write model field: %v", err)
		return "", fmt.Errorf("failed to write model field: %w", err)
	}
	log.Printf("[Whisper] Added model field: whisper-1")

	// Note: Not adding language parameter - Whisper doesn't support 'sa' (Sanskrit) code
	// Let Whisper auto-detect the language, which works well for Sanskrit audio
	log.Printf("[Whisper] Skipping language parameter - letting Whisper auto-detect")

	// Get content type BEFORE closing (boundary is set when writer is created)
	contentType := writer.FormDataContentType()
	log.Printf("[Whisper] Content-Type: %s", contentType)

	// Close the multipart writer (this finalizes the form)
	err = writer.Close()
	if err != nil {
		log.Printf("[Whisper] ERROR: Failed to close multipart writer: %v", err)
		return "", fmt.Errorf("failed to close multipart writer: %w", err)
	}
	log.Printf("[Whisper] Closed multipart writer successfully")

	// Store the body bytes after closing (needed for retries)
	bodyBytes := requestBody.Bytes()
	bodySize := len(bodyBytes)
	log.Printf("[Whisper] Multipart body size: %d bytes (%.2f MB)", bodySize, float64(bodySize)/(1024*1024))

	// Log first and last few bytes for debugging (to verify data integrity)
	if bodySize > 0 {
		firstBytes := bodyBytes
		if len(firstBytes) > 100 {
			firstBytes = firstBytes[:100]
		}
		log.Printf("[Whisper] First 100 bytes (hex): %x", firstBytes)

		if bodySize > 100 {
			lastBytes := bodyBytes[bodySize-100:]
			log.Printf("[Whisper] Last 100 bytes (hex): %x", lastBytes)
		}
	}

	// Create HTTP client with longer timeout for audio transcription
	// Audio transcription can take several minutes for longer recordings
	client := &http.Client{
		Timeout: 300 * time.Second, // 5 minutes - audio transcription can be slow
	}

	// Make the request with retry logic for transient TLS errors
	var resp *http.Response
	maxRetries := 3
	startTime := time.Now()

	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Printf("[Whisper] Attempt %d/%d to transcribe audio", attempt, maxRetries)

		// Create a fresh reader for each attempt from the stored bytes
		bodyReader := bytes.NewReader(bodyBytes)
		log.Printf("[Whisper] Created new bytes.Reader, size: %d bytes", bodyReader.Size())

		// Create HTTP request with fresh reader
		req, err := http.NewRequest("POST", "https://api.openai.com/v1/audio/transcriptions", bodyReader)
		if err != nil {
			log.Printf("[Whisper] ERROR: Failed to create HTTP request: %v", err)
			return "", fmt.Errorf("failed to create request: %w", err)
		}
		log.Printf("[Whisper] Created HTTP request successfully")

		// Set headers
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
		req.Header.Set("Content-Type", contentType)
		log.Printf("[Whisper] Set headers - Authorization: Bearer [REDACTED], Content-Type: %s", contentType)

		// Don't set ContentLength manually - let Go calculate it from the reader
		// Setting it manually can cause TLS issues if there's a mismatch
		log.Printf("[Whisper] Request URL: %s", req.URL.String())
		log.Printf("[Whisper] Request Method: %s", req.Method)

		// Make the request
		requestStartTime := time.Now()
		log.Printf("[Whisper] Sending HTTP request to OpenAI API...")
		resp, err = client.Do(req)
		requestDuration := time.Since(requestStartTime)

		if err == nil {
			log.Printf("[Whisper] Request successful! Status: %d, Duration: %v", resp.StatusCode, requestDuration)
			break
		}

		log.Printf("[Whisper] Request failed after %v: %v", requestDuration, err)

		// Check if it's a TLS error that might be transient
		errStr := err.Error()
		if attempt < maxRetries && (errStr == "remote error: tls: bad record MAC" ||
			strings.Contains(errStr, "tls: bad record MAC")) {
			// Wait before retry (exponential backoff)
			waitTime := time.Duration(attempt) * time.Second
			log.Printf("[Whisper] TLS error detected, waiting %v before retry...", waitTime)
			time.Sleep(waitTime)
			continue
		}

		// For other errors or final attempt, return the error
		log.Printf("[Whisper] ERROR: Failed after %d attempts, total duration: %v", attempt, time.Since(startTime))
		return "", fmt.Errorf("failed to make request to Whisper API (attempt %d/%d): %w", attempt, maxRetries, err)
	}

	if resp == nil {
		log.Printf("[Whisper] ERROR: No response received after %d attempts", maxRetries)
		return "", fmt.Errorf("failed to get response from Whisper API after %d attempts", maxRetries)
	}
	defer resp.Body.Close()

	log.Printf("[Whisper] Response received - Status: %d, Headers: %v", resp.StatusCode, resp.Header)

	// Check response status
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("[Whisper] ERROR: API returned non-200 status. Status: %d, Body: %s", resp.StatusCode, string(bodyBytes))
		return "", fmt.Errorf("Whisper API returned error: %d - %s", resp.StatusCode, string(bodyBytes))
	}

	// Parse response
	var whisperResp WhisperResponse
	if err := json.NewDecoder(resp.Body).Decode(&whisperResp); err != nil {
		log.Printf("[Whisper] ERROR: Failed to decode JSON response: %v", err)
		return "", fmt.Errorf("failed to decode Whisper response: %w", err)
	}

	log.Printf("[Whisper] Transcription successful! Text length: %d characters, Total duration: %v",
		len(whisperResp.Text), time.Since(startTime))
	return whisperResp.Text, nil
}
