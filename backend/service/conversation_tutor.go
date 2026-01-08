package service

import (
	"chaatra/persistence"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/openai"
)

// TranslationState represents the current conversation state
// This is maintained by the backend and passed to the agent
type TranslationState struct {
	Revealed struct {
		RevealedUncompoundedIndices []int `json:"revealed_uncompounded_indices"` // Indices of words with uncompounded form revealed
		RevealedWordIndices         []int `json:"revealed_word_indices"`         // Indices of words with meanings revealed
		FullTranslation             bool  `json:"full_translation"`              // Whether full translation is revealed
	} `json:"revealed"`
	FocusTokens     []string `json:"focus_tokens"`      // Sanskrit tokens currently in focus
	InteractionMode string   `json:"interaction_mode"`  // Current mode (hint, explain, etc.)
	LastUserMessage string   `json:"last_user_message"` // Previous user message for context
}

// AgentResponse is the strict JSON output contract from the agent
type AgentResponse struct {
	Message         string          `json:"message"`          // Agent's conversational response
	SuggestedAction SuggestedAction `json:"suggested_action"` // Optional action suggestion
}

// SuggestedAction represents an action the agent suggests
type SuggestedAction struct {
	Type    string                 `json:"type"`    // none, reveal, focus, explain
	Payload map[string]interface{} `json:"payload"` // Action-specific data
}

// CanonicalData represents authoritative shloka data
// This is the ONLY source of truth - agent must not add or infer beyond this
type CanonicalData struct {
	ShlokaID               string                        `json:"shloka_id"`
	Devanagari             string                        `json:"devanagari"`
	Transliteration        string                        `json:"transliteration"`
	UncompoundedText       string                        `json:"uncompounded_text"`        // Sandhi-split version
	WordToWordTranslation  []persistence.WordTranslation `json:"word_to_word_translation"` // Word-by-word data
	FullEnglishTranslation string                        `json:"full_english_translation"`
}

// System prompt constant - defines agent identity and rules
const conversationSystemPrompt = `You are a Sanskrit Translation Tutor. Keep responses BRIEF and CONCISE.

RULES:
- Be concise: 1-2 sentences maximum. No lengthy explanations.
- NEVER invent meanings beyond canonical data
- Only reference revealed information
- When words are revealed, briefly confirm what was revealed
- Keep "message" field short - focus on what was revealed, not lengthy explanations

CANONICAL DATA (provided below):
- This is the ONLY source of truth
- Do not add, infer, or assume beyond this data

OUTPUT FORMAT:
- Respond ONLY with valid JSON
- Temperature is low (0.3) - be deterministic

Your response must be a JSON object with this exact structure:
{
  "message": "Brief confirmation (1-2 sentences max)",
  "suggested_action": {
    "type": "none|reveal|focus|explain",
    "payload": {}
  }
}

For reveal actions, the payload should be:
- {"type": "uncompounded", "word_indices": [0, 1]} - reveal uncompounded form
- {"type": "word", "word_indices": [0, 1]} - reveal meanings (requires uncompounded first)
- {"type": "full_translation"} - reveal full translation

For focus actions, the payload should be:
- {"tokens": ["कर्मणि", "अधिकारः"]} - focus on specific tokens

Return ONLY valid JSON, no additional text or markdown formatting.`

// GetRevealedUncompoundedWords returns uncompounded forms for only revealed indices
func GetRevealedUncompoundedWords(data *CanonicalData, revealedIndices []int) []persistence.WordTranslation {
	if len(revealedIndices) == 0 || len(data.WordToWordTranslation) == 0 {
		return []persistence.WordTranslation{}
	}

	// Split uncompounded text into words
	uncompoundedWords := strings.Fields(data.UncompoundedText)

	result := make([]persistence.WordTranslation, 0, len(revealedIndices))
	for _, idx := range revealedIndices {
		if idx >= 0 && idx < len(uncompoundedWords) && idx < len(data.WordToWordTranslation) {
			result = append(result, persistence.WordTranslation{
				Word:        uncompoundedWords[idx],
				Translation: data.WordToWordTranslation[idx].Translation,
			})
		}
	}
	return result
}

// GetRevealedWords returns word-by-word data for only revealed words
func GetRevealedWords(data *CanonicalData, revealedIndices []int) []persistence.WordTranslation {
	if len(revealedIndices) == 0 || len(data.WordToWordTranslation) == 0 {
		return []persistence.WordTranslation{}
	}

	result := make([]persistence.WordTranslation, 0, len(revealedIndices))
	for _, idx := range revealedIndices {
		if idx >= 0 && idx < len(data.WordToWordTranslation) {
			result = append(result, data.WordToWordTranslation[idx])
		}
	}
	return result
}

// CanRevealUncompounded validates if uncompounded form can be revealed for a word
func CanRevealUncompounded(data *CanonicalData, wordIndex int) bool {
	if data.UncompoundedText == "" {
		return false
	}
	uncompoundedWords := strings.Fields(data.UncompoundedText)
	return wordIndex >= 0 && wordIndex < len(uncompoundedWords)
}

// CanRevealWord validates if a word meaning can be revealed (must have uncompounded first)
func CanRevealWord(state *TranslationState, wordIndex int) bool {
	// Check if uncompounded form is already revealed for this word
	for _, idx := range state.Revealed.RevealedUncompoundedIndices {
		if idx == wordIndex {
			return true
		}
	}
	return false
}

// ValidateStateTransition ensures users can't skip levels
func ValidateStateTransition(currentState *TranslationState, suggestedAction SuggestedAction, data *CanonicalData) error {
	if suggestedAction.Type != "reveal" {
		return nil // Only validate reveal actions
	}

	payloadType, ok := suggestedAction.Payload["type"].(string)
	if !ok {
		return fmt.Errorf("invalid reveal payload: missing type")
	}

	switch payloadType {
	case "uncompounded":
		wordIndices, ok := suggestedAction.Payload["word_indices"].([]interface{})
		if !ok {
			return fmt.Errorf("invalid reveal payload: word_indices must be an array")
		}
		for _, idx := range wordIndices {
			wordIdx, ok := idx.(float64) // JSON numbers come as float64
			if !ok {
				return fmt.Errorf("invalid reveal payload: word_indices must contain numbers")
			}
			if !CanRevealUncompounded(data, int(wordIdx)) {
				return fmt.Errorf("cannot reveal uncompounded form for word index %d", int(wordIdx))
			}
		}
	case "word":
		wordIndices, ok := suggestedAction.Payload["word_indices"].([]interface{})
		if !ok {
			return fmt.Errorf("invalid reveal payload: word_indices must be an array")
		}
		for _, idx := range wordIndices {
			wordIdx, ok := idx.(float64)
			if !ok {
				return fmt.Errorf("invalid reveal payload: word_indices must contain numbers")
			}
			if !CanRevealWord(currentState, int(wordIdx)) {
				return fmt.Errorf("cannot reveal word meaning for index %d: uncompounded form must be revealed first", int(wordIdx))
			}
		}
	case "full_translation":
		// Full translation can always be revealed
		return nil
	default:
		return fmt.Errorf("invalid reveal type: %s", payloadType)
	}

	return nil
}

// ApplySuggestedAction applies the agent's suggested action to update state
// This is backend gatekeeping - only allowed transitions are applied
func ApplySuggestedAction(currentState *TranslationState, suggestedAction SuggestedAction) *TranslationState {
	// Create a copy of the state
	newState := *currentState
	newState.Revealed.RevealedUncompoundedIndices = make([]int, len(currentState.Revealed.RevealedUncompoundedIndices))
	copy(newState.Revealed.RevealedUncompoundedIndices, currentState.Revealed.RevealedUncompoundedIndices)
	newState.Revealed.RevealedWordIndices = make([]int, len(currentState.Revealed.RevealedWordIndices))
	copy(newState.Revealed.RevealedWordIndices, currentState.Revealed.RevealedWordIndices)

	if suggestedAction.Type != "reveal" {
		return &newState
	}

	payloadType, ok := suggestedAction.Payload["type"].(string)
	if !ok {
		return &newState
	}

	switch payloadType {
	case "uncompounded":
		wordIndices, ok := suggestedAction.Payload["word_indices"].([]interface{})
		if !ok {
			return &newState
		}
		for _, idx := range wordIndices {
			wordIdx, ok := idx.(float64)
			if !ok {
				continue
			}
			idxInt := int(wordIdx)
			// Add to revealed indices if not already present
			found := false
			for _, existingIdx := range newState.Revealed.RevealedUncompoundedIndices {
				if existingIdx == idxInt {
					found = true
					break
				}
			}
			if !found {
				newState.Revealed.RevealedUncompoundedIndices = append(newState.Revealed.RevealedUncompoundedIndices, idxInt)
			}
		}
		// Sort for consistency
		sort.Ints(newState.Revealed.RevealedUncompoundedIndices)
	case "word":
		wordIndices, ok := suggestedAction.Payload["word_indices"].([]interface{})
		if !ok {
			return &newState
		}
		for _, idx := range wordIndices {
			wordIdx, ok := idx.(float64)
			if !ok {
				continue
			}
			idxInt := int(wordIdx)
			// Add to revealed indices if not already present
			found := false
			for _, existingIdx := range newState.Revealed.RevealedWordIndices {
				if existingIdx == idxInt {
					found = true
					break
				}
			}
			if !found {
				newState.Revealed.RevealedWordIndices = append(newState.Revealed.RevealedWordIndices, idxInt)
			}
		}
		// Sort for consistency
		sort.Ints(newState.Revealed.RevealedWordIndices)
	case "full_translation":
		newState.Revealed.FullTranslation = true
	}

	return &newState
}

// ConstructLayeredPrompt builds the three-layer prompt:
// 1. System Prompt (identity + rules)
// 2. Canonical Context (filtered by revealed state)
// 3. State + User Prompt (current state JSON + user message)
func ConstructLayeredPrompt(data *CanonicalData, state *TranslationState, userMessage string) string {
	var canonicalContext strings.Builder

	canonicalContext.WriteString("CANONICAL DATA (Authoritative - DO NOT add or infer beyond this):\n\n")
	canonicalContext.WriteString(fmt.Sprintf("Shloka ID: %s\n", data.ShlokaID))
	canonicalContext.WriteString(fmt.Sprintf("Devanagari: %s\n", data.Devanagari))
	canonicalContext.WriteString(fmt.Sprintf("Transliteration: %s\n\n", data.Transliteration))

	// Only include uncompounded forms for revealed indices
	if len(state.Revealed.RevealedUncompoundedIndices) > 0 {
		canonicalContext.WriteString("Uncompounded Forms (Revealed):\n")
		revealedUncompounded := GetRevealedUncompoundedWords(data, state.Revealed.RevealedUncompoundedIndices)
		for i, word := range revealedUncompounded {
			idx := state.Revealed.RevealedUncompoundedIndices[i]
			canonicalContext.WriteString(fmt.Sprintf("  [%d] %s\n", idx, word.Word))
		}
		canonicalContext.WriteString("\n")
	}

	// Only include word meanings for revealed indices
	if len(state.Revealed.RevealedWordIndices) > 0 {
		canonicalContext.WriteString("Word-by-Word Translation (Revealed):\n")
		revealedWords := GetRevealedWords(data, state.Revealed.RevealedWordIndices)
		for i, word := range revealedWords {
			idx := state.Revealed.RevealedWordIndices[i]
			canonicalContext.WriteString(fmt.Sprintf("  [%d] %s: %s\n", idx, word.Word, word.Translation))
		}
		canonicalContext.WriteString("\n")
	}

	// Only include full translation if revealed
	if state.Revealed.FullTranslation {
		canonicalContext.WriteString(fmt.Sprintf("Full English Translation: %s\n\n", data.FullEnglishTranslation))
	}

	// Build state JSON
	stateJSON, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		log.Printf("Error marshaling state to JSON: %v", err)
		stateJSON = []byte("{}")
	}

	// Construct the full prompt
	prompt := fmt.Sprintf(`%s

%s

CURRENT STATE:
%s

USER MESSAGE:
%s

Remember: You can only reference information that has been revealed. Do not mention unrevealed words, meanings, or translations.`,
		conversationSystemPrompt,
		canonicalContext.String(),
		string(stateJSON),
		userMessage)

	return prompt
}

// InvokeConversationAgent invokes the LangChain agent with GPT-5.1
// Returns the agent's response with strict JSON validation
func InvokeConversationAgent(ctx context.Context, data *CanonicalData, state *TranslationState, userMessage string) (*AgentResponse, error) {
	// Get OpenAI API key from environment
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}

	// Create OpenAI client with GPT-5.1
	// Note: Temperature is set via the model itself or prompt instructions
	// GPT-5.1 should respect the low temperature instruction in the prompt
	llm, err := openai.New(
		openai.WithModel("gpt-5.1"),
		openai.WithToken(apiKey),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OpenAI client: %w", err)
	}

	// Construct the layered prompt
	prompt := ConstructLayeredPrompt(data, state, userMessage)

	// Call the LLM
	completion, err := llms.GenerateFromSinglePrompt(ctx, llm, prompt)
	if err != nil {
		return nil, fmt.Errorf("failed to generate response: %w", err)
	}

	// Parse the JSON response
	var agentResponse AgentResponse

	// Clean up the response (remove markdown code blocks if present)
	cleaned := strings.TrimSpace(completion)
	if strings.HasPrefix(cleaned, "```json") {
		cleaned = strings.TrimPrefix(cleaned, "```json")
		cleaned = strings.TrimPrefix(cleaned, "```")
		cleaned = strings.TrimSuffix(cleaned, "```")
		cleaned = strings.TrimSpace(cleaned)
	} else if strings.HasPrefix(cleaned, "```") {
		cleaned = strings.TrimPrefix(cleaned, "```")
		cleaned = strings.TrimSuffix(cleaned, "```")
		cleaned = strings.TrimSpace(cleaned)
	}

	// Try to parse JSON
	if err := json.Unmarshal([]byte(cleaned), &agentResponse); err != nil {
		log.Printf("Failed to parse LLM response as JSON: %v\nResponse: %s", err, completion)
		return nil, fmt.Errorf("failed to parse LLM response: %w. Response: %s", err, completion)
	}

	// Validate response structure
	if agentResponse.Message == "" {
		return nil, fmt.Errorf("invalid agent response: message is required")
	}

	// Ensure suggested_action has valid type
	if agentResponse.SuggestedAction.Type == "" {
		agentResponse.SuggestedAction.Type = "none"
	}
	if agentResponse.SuggestedAction.Payload == nil {
		agentResponse.SuggestedAction.Payload = make(map[string]interface{})
	}

	return &agentResponse, nil
}
