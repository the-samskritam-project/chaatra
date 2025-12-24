package service

import (
	"chaatra/persistence"
)

// GetAdityaHridayaVerses returns all verses from the Aditya Hridaya Stotra
func GetAdityaHridayaVerses() ([]persistence.AdityaHridayaVerse, error) {
	return persistence.GetAdityaHridayaVerses()
}
