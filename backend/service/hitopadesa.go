package service

import (
	"chaatra/persistence"
	"fmt"
	"sort"
)

// GetHitopadesaChapters returns all chapter metadata
func GetHitopadesaChapters() ([]persistence.HitopadesaChapterMetadata, error) {
	chapters, err := persistence.GetHitopadesaChapters()
	if err != nil {
		return nil, fmt.Errorf("failed to get chapters: %w", err)
	}
	return chapters, nil
}

// GetHitopadesaVerses returns all verses for a given chapter
func GetHitopadesaVerses(chapterNumber int) ([]persistence.HitopadesaVerse, error) {
	verses, err := persistence.GetHitopadesaVerses(chapterNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to get verses for chapter %d: %w", chapterNumber, err)
	}
	return verses, nil
}

// UpdateHitopadesaVerseTranslation updates a verse with a new edited translation
func UpdateHitopadesaVerseTranslation(verseNumber string, editedTranslation string) error {
	if verseNumber == "" {
		return fmt.Errorf("verse number is required")
	}
	if editedTranslation == "" {
		return fmt.Errorf("edited translation cannot be empty")
	}
	return persistence.UpdateHitopadesaVerseTranslation(verseNumber, editedTranslation)
}

// GetPancatantraChapters returns all chapter metadata
func GetPancatantraChapters() ([]persistence.HitopadesaChapterMetadata, error) {
	chapters, err := persistence.GetPancatantraChapters()
	if err != nil {
		return nil, fmt.Errorf("failed to get chapters: %w", err)
	}
	return chapters, nil
}

// GetPancatantraVerses returns all verses for a given chapter
func GetPancatantraVerses(chapterNumber int) ([]persistence.HitopadesaVerse, error) {
	verses, err := persistence.GetPancatantraVerses(chapterNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to get verses for chapter %d: %w", chapterNumber, err)
	}
	return verses, nil
}

// UpdatePancatantraVerseTranslation updates a verse with a new edited translation
func UpdatePancatantraVerseTranslation(verseNumber string, editedTranslation string) error {
	if verseNumber == "" {
		return fmt.Errorf("verse number is required")
	}
	if editedTranslation == "" {
		return fmt.Errorf("edited translation cannot be empty")
	}
	return persistence.UpdatePancatantraVerseTranslation(verseNumber, editedTranslation)
}

// WordCloudItem represents a single item in the word cloud
type WordCloudItem struct {
	Text  string `json:"text"`
	Value int    `json:"value"`
}

// GetPancatantraWordCloudData returns word cloud data structure
func GetPancatantraWordCloudData() ([]WordCloudItem, error) {
	themeCounts, err := persistence.GetPancatantraThemeCounts()
	if err != nil {
		return nil, fmt.Errorf("failed to get theme counts: %w", err)
	}

	// Convert map to slice of WordCloudItem
	items := make([]WordCloudItem, 0, len(themeCounts))
	for theme, count := range themeCounts {
		items = append(items, WordCloudItem{
			Text:  theme,
			Value: count,
		})
	}

	// Sort by frequency (descending)
	sort.Slice(items, func(i, j int) bool {
		return items[i].Value > items[j].Value
	})

	// Return only top 30 themes
	if len(items) > 30 {
		items = items[:30]
	}

	return items, nil
}
