package service

import (
	"fmt"
	"strings"
)

// ValidateCorpusNameForFavorite validates that the corpus name is one of the supported corpora
func ValidateCorpusNameForFavorite(corpusName string) error {
	validCorpora := []string{"bhagavad_gita", "pancatantra", "hitopadesa", "subhashita"}
	corpusNameLower := strings.ToLower(corpusName)

	for _, valid := range validCorpora {
		if corpusNameLower == valid {
			return nil
		}
	}

	return fmt.Errorf("invalid corpus name: %s. Valid options: %v", corpusName, validCorpora)
}

// ValidateCorpusUnitForFavorite validates that the corpus unit is "Verse" (for now)
func ValidateCorpusUnitForFavorite(corpusUnit string) error {
	corpusUnitTrimmed := strings.TrimSpace(corpusUnit)

	if corpusUnitTrimmed == "Verse" {
		return nil
	}

	return fmt.Errorf("invalid corpus unit: %s. Currently only 'Verse' is supported", corpusUnit)
}

// ValidateCorpusUnitIDForFavorite validates the corpus unit ID format for verses
func ValidateCorpusUnitIDForFavorite(corpusName string, corpusUnit string, corpusUnitID string) error {
	corpusName = strings.ToLower(strings.TrimSpace(corpusName))
	corpusUnit = strings.TrimSpace(corpusUnit)
	corpusUnitID = strings.TrimSpace(corpusUnitID)

	if corpusUnitID == "" {
		return fmt.Errorf("corpus_unit_id is required")
	}

	switch corpusUnit {
	case "Verse":
		// For subhashita, verse numbers are simple strings/numbers (e.g., "1", "42", "123")
		if corpusName == "subhashita" {
			// Subhashita verse numbers can be any non-empty string
			// No specific format validation needed beyond non-empty check
			return nil
		}
		// For other corpora (bhagavad_gita, pancatantra, hitopadesa), verse ID should be in format "chapter.verse" (e.g., "1.1", "2.5")
		parts := strings.Split(corpusUnitID, ".")
		if len(parts) != 2 {
			return fmt.Errorf("corpus_unit_id for Verse should be in format 'chapter.verse' (e.g., '1.1')")
		}
		// Use the isNumeric function from notes.go (same package)
		if !isNumeric(parts[0]) || !isNumeric(parts[1]) {
			return fmt.Errorf("corpus_unit_id for Verse should contain numeric values (e.g., '1.1')")
		}
	default:
		return fmt.Errorf("unknown corpus unit type: %s", corpusUnit)
	}

	return nil
}

