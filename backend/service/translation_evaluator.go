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

// HintsUsed is an alias for persistence.HintsUsed to maintain backward compatibility
type HintsUsed = persistence.HintsUsed

// EvaluationResult is an alias for persistence.EvaluationResult to maintain backward compatibility
type EvaluationResult = persistence.EvaluationResult

// System prompt for translation evaluation
const evaluationSystemPrompt = `You are evaluating a student's Sanskrit translation attempt.

TASK:
Evaluate the translation across three dimensions and provide subjective ratings:

1. LANGUAGE MASTERY:
   - Assess based on hints used and their necessity
   - Consider: Did the student need hints for difficult/rare terms vs. basic vocabulary?
   - Fewer hints for difficult terms = higher mastery
   - Rating options: "Excellent", "Good", "Fair", "Needs Improvement"
   - Excellent: No hints or only hints for very rare/complex terms
   - Good: Some hints used, mostly for moderately difficult terms
   - Fair: Many hints used, including for common terms
   - Needs Improvement: Full translation shown or excessive hints for basic vocabulary

2. TRANSLATION FIDELITY:
   - How closely does the translation match the canonical meaning?
   - Consider accuracy of word meanings, grammar, and overall sense
   - Rating options: "Excellent", "Good", "Fair", "Needs Improvement"
   - Excellent: Very close match, minor differences only
   - Good: Mostly accurate with some minor errors
   - Fair: Generally correct but with notable errors or omissions
   - Needs Improvement: Significant errors or major deviations from meaning

3. NUANCE:
   - Does the translation capture nuanced ideas, philosophical depth, or subtle meanings?
   - Consider: Are complex concepts preserved? Is the poetic/philosophical essence maintained?
   - Rating options: "Excellent", "Good", "Fair", "Needs Improvement"
   - Excellent: Captures subtle meanings, philosophical depth, and nuanced expressions
   - Good: Generally captures main ideas with some nuance
   - Fair: Basic meaning conveyed but nuance is lost
   - Needs Improvement: Literal translation without capturing deeper meaning

OUTPUT FORMAT (JSON only):
{
  "language_mastery": "Excellent|Good|Fair|Needs Improvement",
  "translation_fidelity": "Excellent|Good|Fair|Needs Improvement",
  "nuance": "Excellent|Good|Fair|Needs Improvement",
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
		builder.WriteString(fmt.Sprintf("- Uncompounded forms revealed for words at indices: %v\n", hintsUsed.RevealedUncompoundedIndices))
		// Show which words these are
		if len(canonicalData.WordToWordTranslation) > 0 {
			builder.WriteString("  Words with uncompounded forms revealed:\n")
			for _, idx := range hintsUsed.RevealedUncompoundedIndices {
				if idx < len(canonicalData.WordToWordTranslation) {
					word := canonicalData.WordToWordTranslation[idx]
					builder.WriteString(fmt.Sprintf("    [%d] %s: %s\n", idx, word.Word, word.Translation))
				}
			}
		}
	}
	if len(hintsUsed.RevealedWordIndices) > 0 {
		builder.WriteString(fmt.Sprintf("- Word meanings revealed for words at indices: %v\n", hintsUsed.RevealedWordIndices))
		// Show which words these are
		if len(canonicalData.WordToWordTranslation) > 0 {
			builder.WriteString("  Words with meanings revealed:\n")
			for _, idx := range hintsUsed.RevealedWordIndices {
				if idx < len(canonicalData.WordToWordTranslation) {
					word := canonicalData.WordToWordTranslation[idx]
					builder.WriteString(fmt.Sprintf("    [%d] %s: %s\n", idx, word.Word, word.Translation))
				}
			}
		}
	}
	if hintsUsed.FullTranslationShown {
		builder.WriteString("- Full translation was shown\n")
	}
	if len(hintsUsed.RevealedUncompoundedIndices) == 0 && len(hintsUsed.RevealedWordIndices) == 0 && !hintsUsed.FullTranslationShown {
		builder.WriteString("- No hints were used (excellent independence!)\n")
	}
	builder.WriteString("\n")

	// Total word count for context
	if len(canonicalData.WordToWordTranslation) > 0 {
		totalWords := len(canonicalData.WordToWordTranslation)
		hintsCount := len(hintsUsed.RevealedUncompoundedIndices) + len(hintsUsed.RevealedWordIndices)
		if hintsUsed.FullTranslationShown {
			builder.WriteString(fmt.Sprintf("Context: Total words in shloka: %d, Hints used: %d (full translation shown)\n\n", totalWords, hintsCount))
		} else {
			builder.WriteString(fmt.Sprintf("Context: Total words in shloka: %d, Hints used: %d\n\n", totalWords, hintsCount))
		}
	}

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

	// Validate ratings
	validRatings := map[string]bool{
		"Excellent":         true,
		"Good":              true,
		"Fair":              true,
		"Needs Improvement": true,
	}

	if !validRatings[result.LanguageMastery] {
		return nil, fmt.Errorf("invalid language_mastery rating: %s (must be Excellent, Good, Fair, or Needs Improvement)", result.LanguageMastery)
	}
	if !validRatings[result.TranslationFidelity] {
		return nil, fmt.Errorf("invalid translation_fidelity rating: %s (must be Excellent, Good, Fair, or Needs Improvement)", result.TranslationFidelity)
	}
	if !validRatings[result.Nuance] {
		return nil, fmt.Errorf("invalid nuance rating: %s (must be Excellent, Good, Fair, or Needs Improvement)", result.Nuance)
	}

	return &result, nil
}
