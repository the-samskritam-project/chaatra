package main

import (
	"chaatra/core"
	"chaatra/persistence"
	"log"
	"net/http"

	h "chaatra/http"

	"github.com/rs/cors"
)

var d core.Dictionary

func main() {
	// initialize elastic search
	persistence.InitEs()

	core.T = &core.Trie{
		Root: &core.Node{
			Letter: &core.Letter{
				Devanagari: ' ',
			},
			Children: make(map[rune]*core.Node),
		},
	}

	if d = core.Parse(core.T); d != nil {
		core.D = d
		persistence.IndexEntries(d)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/search", h.SearchHandler)
	mux.HandleFunc("/complete", h.AutoCompleteHandler)

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"}, // Allowing only http://localhost:3000
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"}, // Assuming you might need Authorization
		AllowCredentials: true,
		Debug:            true,
	})

	handler := c.Handler(mux)

	log.Println("Starting server on port : 8081")
	err := http.ListenAndServe(":8081", handler)
	if err != nil {
		log.Fatalf("Shutting down server : %s", err.Error())
	} else {
		log.Println("Shutting down server")
	}
}
