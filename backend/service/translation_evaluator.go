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

// HintsUsed represents the hints that were used by the user
type HintsUsed struct {
	RevealedUncompoundedIndices []int `json:"revealed_uncompounded_indices"`
	RevealedWordIndices         []int `json:"revealed_word_indices"`
	FullTranslationShown        bool  `json:"full_translation_shown"`
}

// EvaluationResult represents the result of translation evaluation
type EvaluationResult struct {
	Score               int      `json:"score"`
	Feedback            string   `json:"feedback"`
	Strengths           []string `json:"strengths"`
	AreasForImprovement []string `json:"areas_for_improvement"`
}

// System prompt for translation evaluation
const evaluationSystemPrompt = `You are evaluating a student's Sanskrit translation attempt.

TASK:
1. Assess how independently the student worked (fewer hints = higher score for independence)
2. Evaluate translation accuracy (0-100 score based on correctness)
3. Provide detailed feedback with specific corrections
4. Highlight strengths and areas for improvement

SCORING GUIDELINES:
- Independence (30 points): Fewer hints used = higher score
  - No hints: 30 points
  - Some word hints: 20-25 points
  - Many word hints: 10-15 points
  - Full translation shown: 0-5 points
- Accuracy (70 points): Based on translation correctness
  - Excellent (90-100% correct): 60-70 points
  - Good (70-89% correct): 45-60 points
  - Fair (50-69% correct): 30-45 points
  - Poor (<50% correct): 0-30 points

OUTPUT FORMAT (JSON only):
{
  "score": 85,
  "feedback": "Detailed feedback with specific corrections and suggestions...",
  "strengths": ["Strength 1", "Strength 2"],
  "areas_for_improvement": ["Area 1", "Area 2"]
}

Return ONLY valid JSON, no additional text or markdown formatting.`

// EvaluateTranslation evaluates a user's translation based on hints used and canonical data
func EvaluateTranslation(ctx context.Context, canonicalData *CanonicalData, userTranslation string, hintsUsed *HintsUsed) (*EvaluationResult, error) {
	// Get OpenAI API key
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable is not set")
	}

	// Create OpenAI client
	llm, err := openai.New(
		openai.WithModel("gpt-4o"),
		openai.WithToken(apiKey),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OpenAI client: %w", err)
	}

	// Build evaluation prompt
	prompt := buildEvaluationPrompt(canonicalData, userTranslation, hintsUsed)

	// Invoke LLM
	completion, err := llms.GenerateFromSinglePrompt(ctx, llm, prompt)
	if err != nil {
		return nil, fmt.Errorf("failed to invoke LLM: %w", err)
	}

	// Parse JSON response
	result, err := parseEvaluationResponse(completion)
	if err != nil {
		log.Printf("Failed to parse evaluation response: %v\nRaw response: %s", err, completion)
		return nil, fmt.Errorf("failed to parse evaluation response: %w", err)
	}

	return result, nil
}

// buildEvaluationPrompt constructs the evaluation prompt
func buildEvaluationPrompt(canonicalData *CanonicalData, userTranslation string, hintsUsed *HintsUsed) string {
	var builder strings.Builder

	// System prompt
	builder.WriteString(evaluationSystemPrompt)
	builder.WriteString("\n\n")

	// Context section
	builder.WriteString("CONTEXT:\n")
	builder.WriteString("---\n")

	// Hints used
	builder.WriteString("Hints Used:\n")
	if len(hintsUsed.RevealedUncompoundedIndices) > 0 {
		builder.WriteString(fmt.Sprintf("- Uncompounded forms revealed for words: %v\n", hintsUsed.RevealedUncompoundedIndices))
	}
	if len(hintsUsed.RevealedWordIndices) > 0 {
		builder.WriteString(fmt.Sprintf("- Word meanings revealed for words: %v\n", hintsUsed.RevealedWordIndices))
	}
	if hintsUsed.FullTranslationShown {
		builder.WriteString("- Full translation was shown\n")
	}
	if len(hintsUsed.RevealedUncompoundedIndices) == 0 && len(hintsUsed.RevealedWordIndices) == 0 && !hintsUsed.FullTranslationShown {
		builder.WriteString("- No hints were used (excellent independence!)\n")
	}
	builder.WriteString("\n")

	// User's translation
	builder.WriteString("User's Translation:\n")
	builder.WriteString(userTranslation)
	builder.WriteString("\n\n")

	// Canonical translation
	builder.WriteString("Canonical Translation (reference):\n")
	builder.WriteString(canonicalData.FullEnglishTranslation)
	builder.WriteString("\n\n")

	// Sanskrit text for context
	builder.WriteString("Sanskrit Text:\n")
	builder.WriteString(canonicalData.Devanagari)
	builder.WriteString("\n\n")

	// Word-by-word translation if available (for detailed feedback)
	if len(canonicalData.WordToWordTranslation) > 0 {
		builder.WriteString("Word-by-Word Translation (for reference):\n")
		for i, word := range canonicalData.WordToWordTranslation {
			builder.WriteString(fmt.Sprintf("[%d] %s: %s\n", i, word.Word, word.Translation))
		}
		builder.WriteString("\n")
	}

	builder.WriteString("---\n\n")
	builder.WriteString("Evaluate the translation and provide your response as JSON only.")

	return builder.String()
}

// parseEvaluationResponse parses the LLM response into EvaluationResult
func parseEvaluationResponse(response string) (*EvaluationResult, error) {
	// Remove markdown code blocks if present
	cleaned := strings.TrimSpace(response)
	if strings.HasPrefix(cleaned, "```json") {
		cleaned = strings.TrimPrefix(cleaned, "```json")
		cleaned = strings.TrimSuffix(cleaned, "```")
		cleaned = strings.TrimSpace(cleaned)
	} else if strings.HasPrefix(cleaned, "```") {
		cleaned = strings.TrimPrefix(cleaned, "```")
		cleaned = strings.TrimSuffix(cleaned, "```")
		cleaned = strings.TrimSpace(cleaned)
	}

	var result EvaluationResult
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	// Validate score range
	if result.Score < 0 || result.Score > 100 {
		return nil, fmt.Errorf("invalid score: %d (must be 0-100)", result.Score)
	}

	return &result, nil
}
