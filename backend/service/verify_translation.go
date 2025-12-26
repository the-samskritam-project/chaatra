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

// VerificationResult represents the result of verifying a user's translation
type VerificationResult struct {
	IsAccurate  bool     `json:"is_accurate"`
	Feedback    string   `json:"feedback"`
	Suggestions []string `json:"suggestions,omitempty"`
}

// VerifySubhashitaTranslation verifies a user's translation of a subhashita verse using GPT 5.1
func VerifySubhashitaTranslation(ctx context.Context, devanagariText string, userTranslation string, verseNumber string) (*VerificationResult, error) {
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
	prompt := constructVerificationPrompt(devanagariText, userTranslation, verseNumber)

	// Call the LLM
	completion, err := llms.GenerateFromSinglePrompt(ctx, llm, prompt)
	if err != nil {
		return nil, fmt.Errorf("failed to verify translation: %w", err)
	}

	// Parse the JSON response
	var jsonResponse VerificationResult

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

	return &jsonResponse, nil
}

// constructVerificationPrompt creates a prompt for verifying a user's translation
func constructVerificationPrompt(devanagariText string, userTranslation string, verseNumber string) string {
	return fmt.Sprintf(`You are a supportive and encouraging Sanskrit teacher helping a student learn translation. Your task is to provide helpful, constructive feedback on a user's English translation of a Sanskrit subhashita verse.

Sanskrit Text (in Devanagari):
%s

Verse Number: %s

User's Translation:
%s

Please provide helpful, encouraging feedback that:
1. Acknowledges any correct elements in the translation (even if minimal)
2. Gently points out what might be missing or could be improved
3. Offers constructive guidance on how to approach the translation
4. Explains key elements of the verse that should be included
5. Uses a supportive, educational tone - this is a learning tool, not a harsh critique

Consider:
- What elements of the translation are correct or on the right track?
- What important elements of the verse are missing?
- What guidance can help the user improve their understanding?
- How can you help them see the connections between the Sanskrit words and their meanings?

IMPORTANT: Be encouraging and helpful. Even if the translation is incomplete or incorrect, frame your feedback as guidance for learning, not as criticism. Help the user understand what the verse is about and how to approach translating it.

Return your response as a JSON object with the following structure:
{
  "is_accurate": true/false,
  "feedback": "helpful, encouraging feedback text that guides the user",
  "suggestions": ["helpful suggestion 1", "helpful suggestion 2"]
}

Return ONLY valid JSON, no additional text or markdown formatting.`, devanagariText, verseNumber, userTranslation)
}
