package http

import (
	"chaatra/service"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

// AdityaHridayaVersesHandler returns all verses from the Aditya Hridaya Stotra
func AdityaHridayaVersesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	verses, err := service.GetAdityaHridayaVerses()
	if err != nil {
		log.Printf("Error getting Aditya Hridaya Stotra verses: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get verses: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(verses)
}
