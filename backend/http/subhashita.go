package http

import (
	"chaatra/persistence"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

// SubhashitaRandomHandler returns a random subhashita verse
func SubhashitaRandomHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	verse, err := persistence.GetRandomSubhashita()
	if err != nil {
		log.Printf("Error getting random subhashita: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get random subhashita: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(verse)
}

