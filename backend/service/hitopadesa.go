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

// PancatantraVerseContext represents the context for a verse including interval and adjacent verses
type PancatantraVerseContext struct {
	Interval *PancatantraIntervalResponse `json:"interval"`
	Verses   []*VerseContextItem          `json:"verses"` // [previous, target, next]
}

// PancatantraIntervalResponse represents interval data for API response
type PancatantraIntervalResponse struct {
	Summary       string   `json:"summary"`
	Themes        []string `json:"themes"`
	ChapterNumber int      `json:"chapter_number"`
	IntervalIndex int      `json:"interval_index"`
}

// VerseContextItem represents a verse in the context (can be nil for missing adjacent verses)
type VerseContextItem struct {
	VerseNumber              string `json:"verse_number,omitempty"`
	ProseNumber              string `json:"prose_number,omitempty"`
	Type                     string `json:"type,omitempty"`
	TransliteratedDevanagari string `json:"transliterated_devanagari,omitempty"`
	OriginalIast             string `json:"original_iast,omitempty"`
	FullTranslation          string `json:"full_translation,omitempty"`
}

// GetPancatantraVerseContext returns interval and verse context for a given verse number
// itemType should be "verse" or "prose" to search in the appropriate interval array
func GetPancatantraVerseContext(verseNumber string, itemType string) (*PancatantraVerseContext, error) {
	if verseNumber == "" {
		return nil, fmt.Errorf("verse number is required")
	}

	// Default to "verse" if type is not provided (backward compatibility)
	if itemType == "" {
		itemType = "verse"
	}

	// Parse chapter number from verse number (format: "chapter.verse")
	var chapterNumber int
	_, err := fmt.Sscanf(verseNumber, "%d.", &chapterNumber)
	if err != nil {
		return nil, fmt.Errorf("invalid verse number format: %w", err)
	}

	// Find the interval containing this verse (may be nil if not found or > 25 prose shlokas)
	interval, err := persistence.GetPancatantraIntervalByVerse(verseNumber, itemType)
	if err != nil {
		return nil, fmt.Errorf("failed to find interval: %w", err)
	}

	// Get verses with context (always fetch verses even if no interval found)
	verses, err := persistence.GetPancatantraVersesWithContext(chapterNumber, verseNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to get verses with context: %w", err)
	}

	// Convert interval to response format (may be nil)
	var intervalResp *PancatantraIntervalResponse
	if interval != nil {
		intervalResp = &PancatantraIntervalResponse{
			Summary:       interval.IntervalSummary,
			Themes:        interval.IntervalThemes,
			ChapterNumber: interval.ChapterNumber,
			IntervalIndex: interval.IntervalIndex,
		}
	}

	// Convert verses to response format
	verseItems := make([]*VerseContextItem, 3)
	for i, verse := range verses {
		if verse == nil {
			verseItems[i] = nil
			continue
		}
		verseItems[i] = &VerseContextItem{
			VerseNumber:              verse.VerseNumber,
			ProseNumber:              verse.ProseNumber,
			Type:                     verse.Type,
			TransliteratedDevanagari: verse.TransliteratedDevanagari,
			OriginalIast:             verse.OriginalIast,
			FullTranslation:          verse.FullTranslation,
		}
	}

	return &PancatantraVerseContext{
		Interval: intervalResp,
		Verses:   verseItems,
	}, nil
}

// GetBhagavadGitaChapters returns all chapter metadata
func GetBhagavadGitaChapters() ([]persistence.HitopadesaChapterMetadata, error) {
	chapters, err := persistence.GetBhagavadGitaChapters()
	if err != nil {
		return nil, fmt.Errorf("failed to get chapters: %w", err)
	}
	return chapters, nil
}

// GetBhagavadGitaVerses returns all items (verses and commentary) for a given chapter
func GetBhagavadGitaVerses(chapterNumber int) ([]persistence.HitopadesaVerse, error) {
	verses, err := persistence.GetBhagavadGitaVerses(chapterNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to get verses for chapter %d: %w", chapterNumber, err)
	}
	return verses, nil
}

// UpdateBhagavadGitaVerseTranslation updates a verse or commentary with a new edited translation
func UpdateBhagavadGitaVerseTranslation(verseNumber string, editedTranslation string) error {
	if verseNumber == "" {
		return fmt.Errorf("verse number or ID is required")
	}
	if editedTranslation == "" {
		return fmt.Errorf("edited translation cannot be empty")
	}
	return persistence.UpdateBhagavadGitaVerseTranslation(verseNumber, editedTranslation)
}
