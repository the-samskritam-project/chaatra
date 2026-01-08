package http

import (
	"chaatra/persistence"
	"chaatra/service"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

// ConversationRequest represents the request body for a conversation
type ConversationRequest struct {
	UserMessage string                   `json:"user_message"`
	State       service.TranslationState `json:"state"`
}

// ConversationResponse represents the response from a conversation
type ConversationResponse struct {
	Message         string                   `json:"message"`
	SuggestedAction service.SuggestedAction  `json:"suggested_action"`
	UpdatedState    service.TranslationState `json:"updated_state"`
}

// ConversationHandler handles POST /v2/{corpus}/shloka/{id}/conversation
// This is the main endpoint for the conversational Sanskrit translation tutor
func ConversationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract corpus and shloka ID from path
	// Expected format: /v2/{corpus}/shloka/{id}/conversation
	path := strings.TrimPrefix(r.URL.Path, "/v2/")
	path = strings.TrimSuffix(path, "/conversation")

	parts := strings.Split(path, "/shloka/")
	if len(parts) != 2 {
		http.Error(w, "Invalid path format. Expected: /v2/{corpus}/shloka/{id}/conversation", http.StatusBadRequest)
		return
	}

	corpus := parts[0]
	shlokaID := parts[1]

	if corpus == "" || shlokaID == "" {
		http.Error(w, "Corpus and shloka ID are required", http.StatusBadRequest)
		return
	}

	// Parse request body
	var req ConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if req.UserMessage == "" {
		http.Error(w, "user_message is required", http.StatusBadRequest)
		return
	}

	// Get corpus provider
	provider, err := service.GetCorpusProvider(corpus)
	if err != nil {
		log.Printf("Error getting corpus provider for %s: %v", corpus, err)
		http.Error(w, fmt.Sprintf("Corpus not found: %s", corpus), http.StatusNotFound)
		return
	}

	// Get canonical data
	canonicalData, err := provider.GetCanonicalData(shlokaID)
	if err != nil {
		log.Printf("Error getting canonical data for %s/%s: %v", corpus, shlokaID, err)
		http.Error(w, fmt.Sprintf("Failed to get shloka: %v", err), http.StatusNotFound)
		return
	}

	// Check cache first
	ctx := context.Background()
	cachedResponse, err := persistence.GetCachedResponse(
		shlokaID,
		req.State.Revealed.RevealedUncompoundedIndices,
		req.State.Revealed.RevealedWordIndices,
		req.UserMessage,
	)
	if err != nil {
		log.Printf("Error checking cache: %v", err)
		// Continue without cache - not a fatal error
	}

	var agentResponse *service.AgentResponse

	if cachedResponse != nil {
		// Cache hit - convert bson.M to AgentResponse via JSON
		log.Printf("Using cached response for %s/%s", corpus, shlokaID)
		agentResponse = &service.AgentResponse{}
		// Convert bson.M to JSON bytes, then unmarshal to AgentResponse
		jsonBytes, err := json.Marshal(cachedResponse)
		if err != nil {
			log.Printf("Error marshaling cached response to JSON: %v", err)
			// Fall through to invoke agent
		} else {
			err = json.Unmarshal(jsonBytes, agentResponse)
			if err != nil {
				log.Printf("Error unmarshaling cached response: %v", err)
				// Fall through to invoke agent
			} else {
				// Successfully loaded from cache
			}
		}
	}

	if agentResponse == nil {
		// Cache miss - invoke agent
		log.Printf("Cache miss for %s/%s, invoking agent", corpus, shlokaID)

		agentResponse, err = service.InvokeConversationAgent(
			ctx,
			canonicalData,
			&req.State,
			req.UserMessage,
		)
		if err != nil {
			log.Printf("Error invoking conversation agent: %v", err)
			http.Error(w, fmt.Sprintf("Failed to get agent response: %v", err), http.StatusInternalServerError)
			return
		}

		// Cache the response (with 7 day TTL)
		// Convert AgentResponse to map[string]interface{} for storage via JSON
		jsonBytes, err := json.Marshal(agentResponse)
		if err == nil {
			var responseMap map[string]interface{}
			err = json.Unmarshal(jsonBytes, &responseMap)
			if err == nil {
				if err := persistence.CacheResponse(
					shlokaID,
					req.State.Revealed.RevealedUncompoundedIndices,
					req.State.Revealed.RevealedWordIndices,
					req.UserMessage,
					responseMap,
					7, // 7 days TTL
				); err != nil {
					log.Printf("Error caching response: %v", err)
					// Continue - caching failure is not fatal
				}
			}
		}
	}

	// Validate state transition
	if err := service.ValidateStateTransition(&req.State, agentResponse.SuggestedAction, canonicalData); err != nil {
		log.Printf("Invalid state transition: %v", err)
		http.Error(w, fmt.Sprintf("Invalid state transition: %v", err), http.StatusBadRequest)
		return
	}

	// Apply suggested action to update state
	updatedState := service.ApplySuggestedAction(&req.State, agentResponse.SuggestedAction)

	// Update last user message in state
	updatedState.LastUserMessage = req.UserMessage

	// Build response
	response := ConversationResponse{
		Message:         agentResponse.Message,
		SuggestedAction: agentResponse.SuggestedAction,
		UpdatedState:    *updatedState,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// EvaluationRequest represents the request body for translation evaluation
type EvaluationRequest struct {
	UserTranslation string            `json:"user_translation"`
	HintsUsed       service.HintsUsed `json:"hints_used"`
}

// EvaluationResponse represents the response from translation evaluation
type EvaluationResponse struct {
	Score               int      `json:"score"`
	Feedback            string   `json:"feedback"`
	Strengths           []string `json:"strengths"`
	AreasForImprovement []string `json:"areas_for_improvement"`
}

// EvaluationHandler handles POST /v2/{corpus}/shloka/{id}/evaluate
// This endpoint evaluates a user's translation based on hints used
func EvaluationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract corpus and shloka ID from path
	// Expected format: /v2/{corpus}/shloka/{id}/evaluate
	path := strings.TrimPrefix(r.URL.Path, "/v2/")
	path = strings.TrimSuffix(path, "/evaluate")

	parts := strings.Split(path, "/shloka/")
	if len(parts) != 2 {
		http.Error(w, "Invalid path format. Expected: /v2/{corpus}/shloka/{id}/evaluate", http.StatusBadRequest)
		return
	}

	corpus := parts[0]
	shlokaID := parts[1]

	if corpus == "" || shlokaID == "" {
		http.Error(w, "Corpus and shloka ID are required", http.StatusBadRequest)
		return
	}

	// Parse request body
	var req EvaluationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if req.UserTranslation == "" {
		http.Error(w, "user_translation is required", http.StatusBadRequest)
		return
	}

	// Get corpus provider
	provider, err := service.GetCorpusProvider(corpus)
	if err != nil {
		log.Printf("Error getting corpus provider for %s: %v", corpus, err)
		http.Error(w, fmt.Sprintf("Corpus not found: %s", corpus), http.StatusNotFound)
		return
	}

	// Get canonical data
	canonicalData, err := provider.GetCanonicalData(shlokaID)
	if err != nil {
		log.Printf("Error getting canonical data for %s/%s: %v", corpus, shlokaID, err)
		http.Error(w, fmt.Sprintf("Failed to get shloka: %v", err), http.StatusNotFound)
		return
	}

	// Invoke evaluation agent
	ctx := context.Background()
	evaluation, err := service.EvaluateTranslation(
		ctx,
		canonicalData,
		req.UserTranslation,
		&req.HintsUsed,
	)
	if err != nil {
		log.Printf("Error evaluating translation: %v", err)
		http.Error(w, fmt.Sprintf("Failed to evaluate translation: %v", err), http.StatusInternalServerError)
		return
	}

	// Build response
	response := EvaluationResponse{
		Score:               evaluation.Score,
		Feedback:            evaluation.Feedback,
		Strengths:           evaluation.Strengths,
		AreasForImprovement: evaluation.AreasForImprovement,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}
