package main

import (
	"chaatra/persistence"
	"chaatra/service"
	"log"
	"net/http"
	"os"
	"strings"

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
	mux.HandleFunc("/v2/pancatantra/wordcloud", h.PancatantraWordCloudHandler)
	mux.HandleFunc("/v2/pancatantra/verse-context", h.PancatantraVerseContextHandler)
	mux.HandleFunc("/v2/bhagavad_gita/chapters", h.BhagavadGitaChaptersHandler)
	mux.HandleFunc("/v2/bhagavad_gita/verses", h.BhagavadGitaVersesHandler)
	mux.HandleFunc("/v2/bhagavad_gita/verses/", h.BhagavadGitaUpdateVerseHandler)
	mux.HandleFunc("/v2/bhagavad_gita/search", h.BhagavadGitaSemanticSearchHandler)
	mux.HandleFunc("/v2/aditya_hridaya_stotra/verses", h.AdityaHridayaVersesHandler)
	mux.HandleFunc("/v2/search/semantic", h.SemanticSearchHandler)
	mux.HandleFunc("/subhashita/random", h.SubhashitaRandomHandler)
	mux.HandleFunc("/subhashita/translations", h.JWTAuthMiddleware(h.SubhashitaGetAllTranslationsHandler))
	mux.HandleFunc("/subhashita/", func(w http.ResponseWriter, r *http.Request) {
		// Handle subhashita routes with path parameters
		path := r.URL.Path
		if strings.HasSuffix(path, "/split") {
			if r.Method == http.MethodPost {
				h.SubhashitaSplitHandler(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else if strings.HasSuffix(path, "/translation") {
			if r.Method == http.MethodPut {
				h.JWTAuthMiddleware(h.SubhashitaSaveTranslationHandler)(w, r)
			} else if r.Method == http.MethodGet {
				h.JWTAuthMiddleware(h.SubhashitaGetTranslationHandler)(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else if strings.HasSuffix(path, "/verify") {
			if r.Method == http.MethodPost {
				h.SubhashitaVerifyTranslationHandler(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else {
			http.Error(w, "Not found", http.StatusNotFound)
		}
	})

	// Conversation tutor endpoint - generic for any corpus
	mux.HandleFunc("/v2/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		// Check if this is a conversation endpoint: /v2/{corpus}/shloka/{id}/conversation
		if strings.Contains(path, "/shloka/") && strings.HasSuffix(path, "/conversation") {
			if r.Method == http.MethodPost {
				h.ConversationHandler(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else if strings.Contains(path, "/shloka/") && strings.HasSuffix(path, "/evaluate") {
			// Check if this is an evaluation endpoint: /v2/{corpus}/shloka/{id}/evaluate
			if r.Method == http.MethodPost {
				h.EvaluationHandler(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else {
			// Let other v2 routes handle it
			http.Error(w, "Not found", http.StatusNotFound)
		}
	})

	// Auth endpoints
	mux.HandleFunc("/v2/auth/signin", h.SignInHandler)
	mux.HandleFunc("/v2/auth/users", h.APIKeyMiddleware(h.CreateUserHandler))

	// Notes endpoints (protected by JWT)
	mux.HandleFunc("/v2/notes", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			h.JWTAuthMiddleware(h.CreateNoteHandler)(w, r)
		case http.MethodGet:
			h.JWTAuthMiddleware(h.GetNotesHandler)(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/v2/notes/", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.JWTAuthMiddleware(h.GetNoteHandler)(w, r)
		case http.MethodPut:
			h.JWTAuthMiddleware(h.UpdateNoteHandler)(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Favorites endpoints (protected by JWT)
	mux.HandleFunc("/v2/favorites", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			h.JWTAuthMiddleware(h.StarVerseHandler)(w, r)
		case http.MethodGet:
			h.JWTAuthMiddleware(h.GetFavoritesHandler)(w, r)
		case http.MethodDelete:
			h.JWTAuthMiddleware(h.UnstarVerseHandler)(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/v2/favorites/status", h.JWTAuthMiddleware(h.GetFavoriteStatusHandler))

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "https://chaatra-frontend-production.up.railway.app", "https://vijayasamskritam.org", "http://vijayasamskritam.org"},
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
