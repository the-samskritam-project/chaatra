package service

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// CloudinaryStorageProvider implements StorageProvider using Cloudinary HTTP API
type CloudinaryStorageProvider struct {
	cloudName string
	apiKey    string
	apiSecret string
}

// NewCloudinaryStorageProvider creates a new Cloudinary storage provider
func NewCloudinaryStorageProvider() (*CloudinaryStorageProvider, error) {
	cloudName := strings.TrimSpace(os.Getenv("CLOUDINARY_CLOUD_NAME"))
	apiKey := strings.TrimSpace(os.Getenv("CLOUDINARY_API_KEY"))
	apiSecret := strings.TrimSpace(os.Getenv("CLOUDINARY_API_SECRET"))

	if cloudName == "" || apiKey == "" || apiSecret == "" {
		return nil, fmt.Errorf("Cloudinary credentials not configured (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)")
	}

	return &CloudinaryStorageProvider{
		cloudName: cloudName,
		apiKey:    apiKey,
		apiSecret: apiSecret,
	}, nil
}

// UploadFile uploads a file to Cloudinary and returns its URL
func (c *CloudinaryStorageProvider) UploadFile(ctx context.Context, file io.Reader, filename string, contentType string, folder string) (string, error) {
	// Read file into buffer
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, file); err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	// Generate unique public ID (sanitize filename to remove spaces and special chars)
	ext := filepath.Ext(filename)
	nameWithoutExt := strings.TrimSuffix(filename, ext)
	// Sanitize filename: replace spaces and special characters with underscores
	nameWithoutExt = strings.ReplaceAll(nameWithoutExt, " ", "_")
	nameWithoutExt = strings.ReplaceAll(nameWithoutExt, "/", "_")
	nameWithoutExt = strings.ReplaceAll(nameWithoutExt, "\\", "_")

	// Generate timestamp once - use the same value for both public_id and signature
	timestamp := time.Now().Unix()
	timestampStr := strconv.FormatInt(timestamp, 10)

	hash := sha1.Sum([]byte(fmt.Sprintf("%s%d", filename, timestamp)))
	hashStr := hex.EncodeToString(hash[:])[:8]

	// Include folder in public_id (don't send folder as separate parameter)
	publicID := fmt.Sprintf("%s/%s_%d_%s", folder, nameWithoutExt, timestamp, hashStr)

	// Cloudinary upload URL
	uploadURL := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/video/upload", c.cloudName)

	// Create multipart form
	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)

	// Add file field
	fileWriter, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("failed to create form file: %w", err)
	}
	if _, err := io.Copy(fileWriter, bytes.NewReader(buf.Bytes())); err != nil {
		return "", fmt.Errorf("failed to write file to form: %w", err)
	}

	// Generate signature for authentication (before adding fields)
	// Note: resource_type, api_key, cloud_name, and file are NOT included in signature
	// Only include public_id and timestamp in signature
	signatureParams := map[string]string{
		"public_id": publicID,
		"timestamp": timestampStr,
	}
	signature := generateSignature(signatureParams, c.apiSecret)

	// Add other form fields (note: folder is NOT included since it's part of public_id)
	writer.WriteField("public_id", publicID)
	writer.WriteField("resource_type", "video") // Cloudinary treats audio as video
	writer.WriteField("api_key", c.apiKey)
	writer.WriteField("timestamp", timestampStr)
	writer.WriteField("signature", signature)

	writer.Close()

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", uploadURL, &requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Execute request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to upload to Cloudinary: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Cloudinary upload failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	// Parse response
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	var response struct {
		SecureURL string `json:"secure_url"`
		URL       string `json:"url"`
	}

	if err := json.Unmarshal(bodyBytes, &response); err != nil {
		// Fallback to string parsing if JSON unmarshal fails
		bodyStr := string(bodyBytes)
		if strings.Contains(bodyStr, `"secure_url"`) {
			start := strings.Index(bodyStr, `"secure_url":"`)
			if start != -1 {
				start += len(`"secure_url":"`)
				end := strings.Index(bodyStr[start:], `"`)
				if end != -1 {
					response.SecureURL = bodyStr[start : start+end]
				}
			}
		}
		if response.SecureURL == "" {
			start := strings.Index(bodyStr, `"url":"`)
			if start != -1 {
				start += len(`"url":"`)
				end := strings.Index(bodyStr[start:], `"`)
				if end != -1 {
					response.URL = bodyStr[start : start+end]
				}
			}
			if response.URL != "" {
				response.SecureURL = strings.Replace(response.URL, "http://", "https://", 1)
			}
		}
	}

	if response.SecureURL == "" {
		return "", fmt.Errorf("failed to extract URL from Cloudinary response: %s", string(bodyBytes))
	}

	return response.SecureURL, nil
}

// DeleteFile deletes a file from Cloudinary by its URL
func (c *CloudinaryStorageProvider) DeleteFile(ctx context.Context, url string) error {
	// Extract public ID from URL
	publicID, err := extractPublicIDFromURL(url)
	if err != nil {
		return fmt.Errorf("failed to extract public ID from URL: %w", err)
	}

	// Generate signature
	timestampStr := strconv.FormatInt(time.Now().Unix(), 10)
	signature := generateSignature(map[string]string{
		"public_id":     publicID,
		"resource_type": "video",
		"timestamp":     timestampStr,
	}, c.apiSecret)

	// Delete URL
	deleteURL := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/video/destroy", c.cloudName)

	// Create form data
	formData := fmt.Sprintf("public_id=%s&resource_type=video&timestamp=%s&api_key=%s&signature=%s",
		publicID, timestampStr, c.apiKey, signature)

	req, err := http.NewRequestWithContext(ctx, "POST", deleteURL, strings.NewReader(formData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete from Cloudinary: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Cloudinary delete failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// generateSignature generates Cloudinary signature for authentication
func generateSignature(params map[string]string, apiSecret string) string {
	// Sort parameters by key
	var keys []string
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// Create string to sign
	var parts []string
	for _, k := range keys {
		if v, ok := params[k]; ok {
			parts = append(parts, fmt.Sprintf("%s=%s", k, v))
		}
	}

	// Trim API secret to remove any whitespace/newlines (should already be trimmed, but double-check)
	apiSecret = strings.TrimSpace(apiSecret)
	// Remove any newlines or carriage returns that might have been missed
	apiSecret = strings.ReplaceAll(apiSecret, "\n", "")
	apiSecret = strings.ReplaceAll(apiSecret, "\r", "")

	stringToSign := strings.Join(parts, "&") + apiSecret

	// Generate SHA1 hash
	hash := sha1.Sum([]byte(stringToSign))
	signature := hex.EncodeToString(hash[:])

	return signature
}

// Helper functions for min/max
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// extractPublicIDFromURL extracts the public ID from a Cloudinary URL
func extractPublicIDFromURL(url string) (string, error) {
	// Cloudinary URLs have format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{transformations}/{public_id}.{format}
	parts := strings.Split(url, "/upload/")
	if len(parts) < 2 {
		return "", fmt.Errorf("invalid Cloudinary URL format")
	}

	pathPart := parts[1]
	segments := strings.Split(pathPart, "/")
	if len(segments) == 0 {
		return "", fmt.Errorf("invalid Cloudinary URL format")
	}

	lastSegment := segments[len(segments)-1]
	ext := filepath.Ext(lastSegment)
	publicID := strings.TrimSuffix(lastSegment, ext)

	if len(segments) > 1 {
		folderPath := strings.Join(segments[:len(segments)-1], "/")
		publicID = folderPath + "/" + publicID
	}

	return publicID, nil
}

// ValidateAudioFile checks if a file is a valid audio file
func ValidateAudioFile(filename string, contentType string) error {
	allowedExts := []string{".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".webm"}
	ext := strings.ToLower(filepath.Ext(filename))

	extValid := false
	for _, allowed := range allowedExts {
		if ext == allowed {
			extValid = true
			break
		}
	}

	if !extValid {
		return fmt.Errorf("invalid audio file format. Allowed: %v", allowedExts)
	}

	if contentType != "" {
		mediaType, _, err := mime.ParseMediaType(contentType)
		if err == nil {
			if !strings.HasPrefix(mediaType, "audio/") {
				return fmt.Errorf("invalid content type: %s (expected audio/*)", contentType)
			}
		}
	}

	return nil
}

// GetFileSize reads the size of a file from an io.Reader
func GetFileSize(reader io.Reader) (int64, error) {
	if sizer, ok := reader.(interface{ Size() int64 }); ok {
		return sizer.Size(), nil
	}

	var buf bytes.Buffer
	size, err := io.Copy(&buf, reader)
	if err != nil {
		return 0, err
	}

	if seeker, ok := reader.(io.Seeker); ok {
		seeker.Seek(0, io.SeekStart)
	}

	return size, nil
}

// FormatFileSize formats file size in bytes to human-readable string
func FormatFileSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return strconv.FormatInt(bytes, 10) + " B"
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
