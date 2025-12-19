package service

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/openai"
)

// GenerateTranslation generates an English translation of a Sanskrit shloka using OpenAI
func GenerateTranslation(ctx context.Context, devanagariText string, verseNumber string) (string, error) {
	// Get OpenAI API key from environment
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}

	// Get model from environment or default to GPT-4o
	model := os.Getenv("OPENAI_TRANSLATION_MODEL")
	if model == "" {
		model = "gpt-4o" // Default to GPT-4o for better translation quality
	}

	// Create OpenAI client
	llm, err := openai.New(
		openai.WithModel(model),
		openai.WithToken(apiKey),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create OpenAI client: %w", err)
	}

	// Construct the prompt
	prompt := constructTranslationPrompt(devanagariText, verseNumber)

	// Call the LLM
	completion, err := llms.GenerateFromSinglePrompt(ctx, llm, prompt)
	if err != nil {
		return "", fmt.Errorf("failed to generate translation: %w", err)
	}

	// Clean up the response (remove markdown formatting if present)
	translation := strings.TrimSpace(completion)

	// Remove markdown code blocks if present
	if strings.HasPrefix(translation, "```") {
		lines := strings.Split(translation, "\n")
		// Remove first line (```) and last line (```)
		if len(lines) > 2 {
			translation = strings.Join(lines[1:len(lines)-1], "\n")
		}
		translation = strings.TrimSpace(translation)
	}

	return translation, nil
}

// constructTranslationPrompt creates a prompt for translating Sanskrit shlokas
func constructTranslationPrompt(devanagariText string, verseNumber string) string {
	return fmt.Sprintf(`You are an expert translator specializing in Sanskrit literature, particularly the Bhagavad Gita. Your task is to translate the given Sanskrit shloka into fluent, accurate English.

Shloka (in Devanagari):
%s

Verse Number: %s

Please provide a fluent, accurate English translation that:
1. Preserves the meaning and philosophical depth of the original Sanskrit
2. Is natural and readable in English
3. Maintains the poetic quality where appropriate
4. Considers the context of the Bhagavad Gita
5. Uses appropriate English terminology for Sanskrit concepts

Return ONLY the translation text, without any additional commentary, explanations, or markdown formatting.`, devanagariText, verseNumber)
}
