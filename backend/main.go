package main

import (
	"log"
	"net/http"

	"github.com/rs/cors"
)

var t *trie

var d *dictionary

func main() {
	// initialize elastic search
	initEs()

	t = &trie{
		root: &node{
			letter: &letter{
				devanagari: ' ',
			},
			children: make(map[rune]*node),
		},
	}

	parse(t)

	mux := http.NewServeMux()

	mux.HandleFunc("/search", searchHandler)

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
