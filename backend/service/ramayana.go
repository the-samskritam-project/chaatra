package service

import (
	"bytes"
	"chaatra/persistence"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
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

type exploreShloka struct {
	persistence.RamayanaEntry
	Metrics struct {
		SplitWordCount       int     `json:"split_word_count"`
		SplitComplexityScore float64 `json:"split_complexity_score"`
		RarityScore          float64 `json:"rarity_score"`
		ComplexityScore      float64 `json:"complexity_score"`
	} `json:"metrics"`
}

var (
	exploreDataOnce sync.Once
	exploreDataErr  error
	exploreEntries  []exploreShloka
)

const exploreDataPathEnv = "RAMAYANA_RARITY_PATH"

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

func loadExploreDataset() error {
	exploreDataOnce.Do(func() {
		path := os.Getenv(exploreDataPathEnv)
		if path == "" {
			exploreDataErr = fmt.Errorf("%s not set", exploreDataPathEnv)
			return
		}
		data, err := os.ReadFile(path)
		if err != nil {
			exploreDataErr = fmt.Errorf("failed to read explore dataset: %w", err)
			return
		}
		if err := json.Unmarshal(data, &exploreEntries); err != nil {
			exploreDataErr = fmt.Errorf("failed to parse explore dataset: %w", err)
			return
		}
	})
	return exploreDataErr
}

func GetRandomShlokaByComplexity(score float64) (*exploreShloka, error) {
	if score < 0 {
		score = 0
	}
	if score > 1 {
		score = 1
	}
	if err := loadExploreDataset(); err != nil {
		return nil, err
	}
	if len(exploreEntries) == 0 {
		return nil, fmt.Errorf("explore dataset is empty")
	}

	window := 0.05
	const maxWindow = 0.3

	for window <= maxWindow {
		var candidates []exploreShloka
		lower := math.Max(0, score-window)
		upper := math.Min(1, score+window)

		for _, entry := range exploreEntries {
			c := entry.Metrics.ComplexityScore
			if c >= lower && c <= upper {
				candidates = append(candidates, entry)
			}
		}

		if len(candidates) > 0 {
			idx := rand.Intn(len(candidates))
			return &candidates[idx], nil
		}

		window += 0.05
	}

	return nil, fmt.Errorf("no shlokas found near score %.2f", score)
}

// GetExploreShlokaHandler handles GET /api/ramayana/explore?score=0.7
func GetExploreShlokaHandler(w http.ResponseWriter, r *http.Request) {
	score := 0.5
	if raw := r.URL.Query().Get("score"); raw != "" {
		if v, err := strconv.ParseFloat(raw, 64); err == nil {
			score = v
		}
	}

	shloka, err := GetRandomShlokaByComplexity(score)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(shloka); err != nil {
		http.Error(w, fmt.Sprintf("failed to encode response: %v", err), http.StatusInternalServerError)
		return
	}
}
