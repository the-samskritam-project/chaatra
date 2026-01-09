package service

import (
	"context"
	"io"
)

// StorageProvider defines the interface for file storage operations
type StorageProvider interface {
	// UploadFile uploads a file and returns its public URL
	// folder is the Cloudinary folder path (e.g., "chaatra/recordings/aditya_hridaya_stotra")
	UploadFile(ctx context.Context, file io.Reader, filename string, contentType string, folder string) (url string, err error)

	// DeleteFile deletes a file by its URL
	DeleteFile(ctx context.Context, url string) error
}

// GetStorageProvider returns the configured storage provider
// Currently returns Cloudinary provider, but can be extended to support others
func GetStorageProvider() (StorageProvider, error) {
	return NewCloudinaryStorageProvider()
}
