package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/openai"
)

// WordAnalysisResult represents the grammatical analysis of a Sanskrit word
type WordAnalysisResult struct {
	PartOfSpeech string                 `json:"part_of_speech"`
	Forms        map[string]interface{} `json:"forms"` // Vibhaktis for nouns, verb forms for verbs
	Root         string                 `json:"root,omitempty"`
	Gender       string                 `json:"gender,omitempty"` // For nouns
	Meaning      string                 `json:"meaning,omitempty"`
}

// AnalyzeWord analyzes a Sanskrit word and returns its grammatical information
func AnalyzeWord(ctx context.Context, word string) (*WordAnalysisResult, error) {
	// Get OpenAI API key from environment
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}

	// Create OpenAI client with GPT-4o (good balance of quality and speed)
	llm, err := openai.New(
		openai.WithModel("gpt-4o"),
		openai.WithToken(apiKey),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OpenAI client: %w", err)
	}

	// Construct the prompt
	prompt := constructWordAnalysisPrompt(word)

	// Call the LLM
	completion, err := llms.GenerateFromSinglePrompt(ctx, llm, prompt)
	if err != nil {
		return nil, fmt.Errorf("failed to generate analysis: %w", err)
	}

	// Parse the JSON response
	var result WordAnalysisResult

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

	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		log.Printf("Failed to parse LLM response as JSON: %v\nResponse: %s", err, completion)
		return nil, fmt.Errorf("failed to parse LLM response: %w. Response: %s", err, completion)
	}

	return &result, nil
}

// constructWordAnalysisPrompt creates a prompt for analyzing a Sanskrit word
func constructWordAnalysisPrompt(word string) string {
	return fmt.Sprintf(`You are an expert in Sanskrit grammar. Analyze the following Sanskrit word and provide its grammatical information.

Word: %s

Please provide:
1. Part of speech (noun, verb, adjective, pronoun, etc.)
2. If it's a noun:
   - Gender (masculine, feminine, neuter)
   - Root form (prātipadika)
   - All 8 vibhaktis (cases) for singular, dual, and plural:
     * Nominative (prathamā)
     * Accusative (dvitīyā)
     * Instrumental (tṛtīyā)
     * Dative (caturthī)
     * Ablative (pañcamī)
     * Genitive (ṣaṣṭhī)
     * Locative (saptamī)
     * Vocative (sambodhana)
3. If it's a verb:
   - Root form (dhātu)
   - Verb forms including:
     * Present tense (laṭ lakāra) - 3 persons × 3 numbers
     * Past tense (laṅ lakāra) - 3 persons × 3 numbers
     * Future tense (lṛṭ lakāra) - 3 persons × 3 numbers
     * Imperative (loṭ lakāra) - 3 persons × 3 numbers
     * Optative (liṅ lakāra) - 3 persons × 3 numbers
4. Basic meaning/translation

Return your response as a JSON object with the following structure:
{
  "part_of_speech": "noun" or "verb" or "adjective" etc.,
  "root": "root form",
  "gender": "masculine/feminine/neuter" (only for nouns),
  "meaning": "basic meaning",
  "forms": {
    // For nouns:
    "singular": {
      "nominative": "form",
      "accusative": "form",
      "instrumental": "form",
      "dative": "form",
      "ablative": "form",
      "genitive": "form",
      "locative": "form",
      "vocative": "form"
    },
    "dual": { ... same cases ... },
    "plural": { ... same cases ... }
    // For verbs:
    "present": {
      "first_person_singular": "form",
      "first_person_dual": "form",
      "first_person_plural": "form",
      "second_person_singular": "form",
      "second_person_dual": "form",
      "second_person_plural": "form",
      "third_person_singular": "form",
      "third_person_dual": "form",
      "third_person_plural": "form"
    },
    "past": { ... same persons/numbers ... },
    "future": { ... same persons/numbers ... },
    "imperative": { ... same persons/numbers ... },
    "optative": { ... same persons/numbers ... }
  }
}

CRITICAL REQUIREMENTS:
- Return ONLY valid JSON, no additional text or markdown formatting
- Use Devanagari script for all word forms
- Be accurate with Sanskrit grammar rules
- If the word is not a noun or verb, still provide part_of_speech and any relevant forms
- For nouns, always provide all 8 cases for all 3 numbers (24 forms total)
- For verbs, provide forms for all tenses/moods mentioned

JSON Response:`, word)
}

