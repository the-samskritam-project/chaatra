package persistence

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

type RamayanaEntry struct {
	Kanda           string `json:"kanda"`
	Sarga           int    `json:"sarga"`
	Shloka          int    `json:"shloka"`
	ShlokaText      string `json:"shloka_text"`
	Transliteration string `json:"transliteration"`
	Translation     string `json:"translation"`
	Explanation     string `json:"explanation"`
	Comments        string `json:"comments"`
}

var (
	ramayanaEntries []RamayanaEntry
	ramayanaIndex   map[string]int
	ramayanaOnce    sync.Once
	ramayanaErr     error
)

func loadRamayanaDataset() error {
	ramayanaOnce.Do(func() {
		ramayanaIndex = make(map[string]int)
		path := os.Getenv("RAMAYANA_DATA_PATH")
		if path == "" {
			ramayanaErr = fmt.Errorf("RAMAYANA_DATA_PATH not set")
			return
		}

		data, err := os.ReadFile(path)
		if err != nil {
			ramayanaErr = fmt.Errorf("failed to read ramayana dataset: %w", err)
			return
		}

		if err := json.Unmarshal(data, &ramayanaEntries); err != nil {
			ramayanaErr = fmt.Errorf("failed to parse ramayana dataset: %w", err)
			return
		}

		for i, entry := range ramayanaEntries {
			key := ramayanaKey(entry.Kanda, entry.Sarga, entry.Shloka)
			ramayanaIndex[key] = i
		}
	})

	return ramayanaErr
}

func ramayanaKey(kanda string, sarga, shloka int) string {
	return fmt.Sprintf("%s|%d|%d", kanda, sarga, shloka)
}

// GetRamayanaContext returns entries around the requested shloka (±window)
func GetRamayanaContext(kanda string, sarga, shloka, window int) ([]RamayanaEntry, error) {
	if err := loadRamayanaDataset(); err != nil {
		return nil, err
	}

	key := ramayanaKey(kanda, sarga, shloka)
	index, ok := ramayanaIndex[key]
	if !ok {
		return nil, fmt.Errorf("shloka not found: %s (sarga %d, shloka %d)", kanda, sarga, shloka)
	}

	if window < 0 {
		window = 0
	}

	start := index - window
	if start < 0 {
		start = 0
	}

	end := index + window + 1
	if end > len(ramayanaEntries) {
		end = len(ramayanaEntries)
	}

	return ramayanaEntries[start:end], nil
}
