package service

import (
	"bytes"
	"chaatra/persistence"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	openAIChatURL       = "https://api.openai.com/v1/chat/completions"
	defaultSummaryModel = "gpt-4o-mini"
)

// RamayanaSummarizeRequest represents the request body for summarization
type RamayanaSummarizeRequest struct {
	Kanda  string `json:"kanda"`
	Sarga  int    `json:"sarga"`
	Shloka int    `json:"shloka"`
	Window int    `json:"window"`
	Prompt string `json:"prompt"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
}

type chatChoice struct {
	Message chatMessage `json:"message"`
}

type chatCompletionResponse struct {
	Choices []chatChoice `json:"choices"`
	Error   *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

// CallOpenAISummary sends the Ramayana context to OpenAI and returns a concise summary.
func CallOpenAISummary(apiKey string, req RamayanaSummarizeRequest, context []persistence.RamayanaEntry) (string, error) {
	if len(context) == 0 {
		return "", fmt.Errorf("no context entries to summarize")
	}

	ctxText := buildContextText(context)

	userPrompt := fmt.Sprintf(
		"Provide a concise, faithful summary for Ramayana %s, Sarga %d, Shloka %d (±%d window).\nCustom prompt: %s\n\nContext:\n%s",
		req.Kanda, req.Sarga, req.Shloka, req.Window, strings.TrimSpace(req.Prompt), ctxText,
	)

	payload := chatCompletionRequest{
		Model:       defaultSummaryModel,
		Temperature: 0.2,
		MaxTokens:   400,
		Messages: []chatMessage{
			{
				Role: "system",
				Content: "You are a Sanskrit Ramayana scholar. Summaries must stay close to the provided material, " +
					"highlighting meaning and devotional themes without fabricating details. Mention important names and places when relevant.",
			},
			{
				Role:    "user",
				Content: userPrompt,
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal OpenAI payload: %w", err)
	}

	reqCtx, err := http.NewRequest(http.MethodPost, openAIChatURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create OpenAI request: %w", err)
	}

	reqCtx.Header.Set("Authorization", "Bearer "+apiKey)
	reqCtx.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(reqCtx)
	if err != nil {
		return "", fmt.Errorf("OpenAI request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read OpenAI response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OpenAI API error (%d): %s", resp.StatusCode, string(respBody))
	}

	var completion chatCompletionResponse
	if err := json.Unmarshal(respBody, &completion); err != nil {
		return "", fmt.Errorf("failed to parse OpenAI response: %w", err)
	}

	if completion.Error != nil {
		return "", fmt.Errorf("OpenAI error: %s (%s)", completion.Error.Message, completion.Error.Type)
	}

	if len(completion.Choices) == 0 {
		return "", fmt.Errorf("OpenAI response missing choices")
	}

	return strings.TrimSpace(completion.Choices[0].Message.Content), nil
}

func buildContextText(entries []persistence.RamayanaEntry) string {
	var b strings.Builder
	for _, entry := range entries {
		fmt.Fprintf(&b, "Kanda: %s | Sarga: %d | Shloka: %d\n", entry.Kanda, entry.Sarga, entry.Shloka)
		if entry.ShlokaText != "" {
			fmt.Fprintf(&b, "Sanskrit: %s\n", entry.ShlokaText)
		}
		if entry.Transliteration != "" {
			fmt.Fprintf(&b, "Transliteration: %s\n", entry.Transliteration)
		}
		if entry.Translation != "" {
			fmt.Fprintf(&b, "Translation: %s\n", entry.Translation)
		}
		if entry.Explanation != "" {
			fmt.Fprintf(&b, "Explanation: %s\n", entry.Explanation)
		}
		if entry.Comments != "" {
			fmt.Fprintf(&b, "Comments: %s\n", entry.Comments)
		}
		b.WriteString("\n")
	}
	return b.String()
}
