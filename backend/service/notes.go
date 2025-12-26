package service

import (
	"fmt"
	"strings"
)

// ValidateCorpusName validates that the corpus name is one of the supported corpora
func ValidateCorpusName(corpusName string) error {
	validCorpora := []string{"bhagavad_gita", "pancatantra", "hitopadesa", "subhashita"}
	corpusNameLower := strings.ToLower(corpusName)

	for _, valid := range validCorpora {
		if corpusNameLower == valid {
			return nil
		}
	}

	return fmt.Errorf("invalid corpus name: %s. Valid options: %v", corpusName, validCorpora)
}

// ValidateCorpusUnit validates that the corpus unit is one of the supported types
func ValidateCorpusUnit(corpusUnit string) error {
	validUnits := []string{"General", "Chapter", "Verse", "Annotation", "Commentary"}
	corpusUnitTrimmed := strings.TrimSpace(corpusUnit)

	for _, valid := range validUnits {
		if corpusUnitTrimmed == valid {
			return nil
		}
	}

	return fmt.Errorf("invalid corpus unit: %s. Valid options: %v", corpusUnit, validUnits)
}

// ValidateCorpusUnitID validates the corpus unit ID format based on the corpus unit type
func ValidateCorpusUnitID(corpusUnit string, corpusUnitID string) error {
	corpusUnit = strings.TrimSpace(corpusUnit)
	corpusUnitID = strings.TrimSpace(corpusUnitID)

	switch corpusUnit {
	case "General":
		// General notes don't require a corpus_unit_id (can be empty)
		return nil
	case "Chapter":
		// Chapter ID should be a number (e.g., "1", "2")
		if corpusUnitID == "" {
			return fmt.Errorf("corpus_unit_id is required for Chapter notes")
		}
		// Basic validation: should be numeric
		if !isNumeric(corpusUnitID) {
			return fmt.Errorf("corpus_unit_id for Chapter should be numeric (e.g., '1', '2')")
		}
	case "Verse":
		// Verse ID format depends on corpus:
		// - For subhashita: plain number (e.g., "1", "2")
		// - For others: "chapter.verse" format (e.g., "1.1", "2.5")
		if corpusUnitID == "" {
			return fmt.Errorf("corpus_unit_id is required for Verse notes")
		}
		// Check if it's a plain number (for subhashita) or chapter.verse format
		if isNumeric(corpusUnitID) {
			// Plain number format (valid for subhashita)
			return nil
		}
		parts := strings.Split(corpusUnitID, ".")
		if len(parts) != 2 {
			return fmt.Errorf("corpus_unit_id for Verse should be in format 'chapter.verse' (e.g., '1.1') or plain number (e.g., '1')")
		}
		if !isNumeric(parts[0]) || !isNumeric(parts[1]) {
			return fmt.Errorf("corpus_unit_id for Verse should contain numeric values (e.g., '1.1')")
		}
	case "Annotation", "Commentary":
		// Annotation and Commentary IDs can be any string identifier
		if corpusUnitID == "" {
			return fmt.Errorf("corpus_unit_id is required for %s notes", corpusUnit)
		}
	default:
		return fmt.Errorf("unknown corpus unit type: %s", corpusUnit)
	}

	return nil
}

// isNumeric checks if a string contains only numeric characters
func isNumeric(s string) bool {
	if s == "" {
		return false
	}
	for _, char := range s {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}
