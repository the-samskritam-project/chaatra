package service

import (
	"chaatra/persistence"
	"fmt"
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
