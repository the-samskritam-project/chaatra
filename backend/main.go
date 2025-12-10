package main

import (
	"chaatra/persistence"
	"chaatra/service"
	"log"
	"net/http"
	"os"

	h "chaatra/http"

	"github.com/joho/godotenv"

	"github.com/rs/cors"
)

const ENV_DEFAULT_PORT = "8081"
const ENV_PORT_KEY = "PORT"

func main() {
	_ = godotenv.Load()

	// initialize elastic search
	persistence.InitEs()

	// Initialize ChromaDB if URL is provided (optional)
	chromaURL := os.Getenv("CHROMA_URL")
	if chromaURL != "" {
		persistence.InitChroma(chromaURL)
		log.Println("ChromaDB initialized at:", chromaURL)
	} else {
		log.Println("ChromaDB not initialized (set CHROMA_URL env var to enable)")
	}

	// Initialize MongoDB if URI is provided (optional)
	persistence.InitMongoDB()

	var err error
	h.Dictionary, err = service.ParseApteDictionary(`dictionary.xml`)
	if err != nil {
		log.Println(`error parsing the dicrionary : `, err.Error())

		os.Exit(1)
	}

	h.Trie = service.BuildTrie(h.Dictionary)

	mux := http.NewServeMux()

	mux.HandleFunc("/search", h.SearchHandler)
	mux.HandleFunc("/complete", h.AutoCompleteHandler)
	mux.HandleFunc("/dhatus", h.SearchDhatuHandler)
	mux.HandleFunc("/transliterate", h.TransliterateHandler)
	mux.HandleFunc("/v2/search/english", h.SearchV2EnglishHandler)
	mux.HandleFunc("/v2/search/ramayana", h.SearchRamayanaHandler)
	mux.HandleFunc("/v2/ramayana/context", h.RamayanaContextHandler)
	mux.HandleFunc("/v2/ramayana/explore", h.RamayanaExploreHandler)
	mux.HandleFunc("/v2/ramayana/summarize", h.RamayanaSummarizeHandler)
	mux.HandleFunc("/v2/hitopadesa/chapters", h.HitopadesaChaptersHandler)
	mux.HandleFunc("/v2/hitopadesa/verses", h.HitopadesaVersesHandler)
	mux.HandleFunc("/v2/hitopadesa/verses/", h.HitopadesaUpdateVerseHandler)
	mux.HandleFunc("/v2/pancatantra/chapters", h.PancatantraChaptersHandler)
	mux.HandleFunc("/v2/pancatantra/verses", h.PancatantraVersesHandler)
	mux.HandleFunc("/v2/pancatantra/verses/", h.PancatantraUpdateVerseHandler)

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "https://chaatra-frontend-production.up.railway.app"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"}, // Assuming you might need Authorization
		AllowCredentials: true,
	})

	handler := c.Handler(mux)

	port := os.Getenv(ENV_PORT_KEY)
	if port == "" {
		port = ENV_DEFAULT_PORT
	}

	log.Println("Starting server on port : ", port)
	err = http.ListenAndServe(":"+port, handler)
	if err != nil {
		log.Fatalf("Shutting down server : %s", err.Error())
	} else {
		log.Println("Shutting down server")
	}
}
