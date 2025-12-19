package service

import (
	"chaatra/persistence"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/openai"
)

// SplitResult represents the result of splitting a shloka
type SplitResult struct {
	UncompoundedShloka    string                        `json:"uncompounded_shloka"`
	WordByWordTranslation []persistence.WordTranslation `json:"word_by_word_translation"`
}

// SplitSandhi splits sandhis in a Sanskrit shloka and generates word-by-word translation
func SplitSandhi(ctx context.Context, devanagariText string, verseNumber string) (*SplitResult, error) {
	// Get OpenAI API key from environment
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}

	// Create OpenAI client with GPT-5.1
	llm, err := openai.New(
		openai.WithModel("gpt-5.1"),
		openai.WithToken(apiKey),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OpenAI client: %w", err)
	}

	// Construct the prompt
	prompt := constructSplitPrompt(devanagariText, verseNumber)

	// Call the LLM with minimal reasoning effort
	// Note: langchaingo may not directly support reasoning_effort parameter yet
	// We'll use the standard GenerateFromSinglePrompt for now
	// If reasoning_effort is needed, we may need to use the OpenAI SDK directly
	completion, err := llms.GenerateFromSinglePrompt(ctx, llm, prompt)
	if err != nil {
		return nil, fmt.Errorf("failed to generate split: %w", err)
	}

	// Parse the JSON response
	var jsonResponse struct {
		UncompoundedShloka    string `json:"uncompounded_shloka"`
		WordByWordTranslation []struct {
			Word        string `json:"word"`
			Translation string `json:"translation"`
		} `json:"word_by_word_translation"`
	}

	// Try to parse JSON, handling markdown code blocks
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

	if err := json.Unmarshal([]byte(cleaned), &jsonResponse); err != nil {
		log.Printf("Failed to parse LLM response as JSON: %v\nResponse: %s", err, completion)
		return nil, fmt.Errorf("failed to parse LLM response: %w. Response: %s", err, completion)
	}

	// Convert to SplitResult
	result := &SplitResult{
		UncompoundedShloka:    jsonResponse.UncompoundedShloka,
		WordByWordTranslation: make([]persistence.WordTranslation, len(jsonResponse.WordByWordTranslation)),
	}

	for i, item := range jsonResponse.WordByWordTranslation {
		result.WordByWordTranslation[i] = persistence.WordTranslation{
			Word:        item.Word,
			Translation: item.Translation,
		}
	}

	return result, nil
}

// constructSplitPrompt creates a prompt for splitting sandhis
func constructSplitPrompt(devanagariText string, verseNumber string) string {
	return fmt.Sprintf(`You are an expert in Sanskrit grammar and sandhi (phonetic combination rules). Your task is to split all sandhis in the given Sanskrit shloka and provide word-by-word translations.

Shloka (in Devanagari):
%s

Verse Number: %s

Please:
1. Split all sandhis (compound words) in the shloka to show the uncompounded form
2. Provide word-by-word English translation for each word in the uncompounded shloka
3. Return your response as a JSON object with the following structure:
{
  "uncompounded_shloka": "the shloka with all sandhis split, words separated by spaces",
  "word_by_word_translation": [
    {"word": "word1", "translation": "translation1"},
    {"word": "word2", "translation": "translation2"}
  ]
}

CRITICAL REQUIREMENTS:
- Preserve the Devanagari script in the uncompounded_shloka
- You MUST preserve ALL dandas (। and ॥) from the original verse in their exact positions
- If the original verse has a danda (।) after a word, include it after that word in the split version
- If the original verse ends with ॥, include it at the end
- Maintain the exact same structure and formatting as the original, including:
  * All dandas (। and ॥) in their original positions
  * Line breaks if the verse spans multiple lines (use \n for line breaks)
  * The same visual structure
- Each uncompounded word should be separated by a space
- Include all words from the original shloka (no words should be missing)
- Provide accurate translations based on Sanskrit grammar and context
- Return ONLY valid JSON, no additional text or markdown formatting

Example: If the original is "word1। word2॥", the split should be "word1 word2। word3 word4॥" (preserving dandas)

JSON Response:`, devanagariText, verseNumber)
}
