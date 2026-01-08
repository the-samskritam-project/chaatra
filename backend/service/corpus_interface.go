package service

import (
	"chaatra/persistence"
	"fmt"
)

// CorpusDataProvider is a generic interface for retrieving canonical shloka data
// This allows the conversation tutor to work with any corpus (subhashita, ramayana, etc.)
type CorpusDataProvider interface {
	GetCanonicalData(shlokaID string) (*CanonicalData, error)
	GetCorpusName() string
}

// SubhashitaDataProvider implements CorpusDataProvider for subhashita corpus
type SubhashitaDataProvider struct{}

// GetCorpusName returns the corpus name
func (p *SubhashitaDataProvider) GetCorpusName() string {
	return "subhashita"
}

// GetCanonicalData retrieves canonical data for a subhashita verse
func (p *SubhashitaDataProvider) GetCanonicalData(shlokaID string) (*CanonicalData, error) {
	verse, err := persistence.GetSubhashitaByVerseNumber(shlokaID)
	if err != nil {
		return nil, fmt.Errorf("failed to get subhashita verse: %w", err)
	}

	// Convert SubhashitaVerse to CanonicalData
	data := &CanonicalData{
		ShlokaID:               verse.VerseNumber,
		Devanagari:             verse.TransliteratedDevanagari,
		Transliteration:        verse.OriginalIast,
		UncompoundedText:       verse.SplitShloka,
		WordToWordTranslation:  verse.SplitWordByWordTranslation,
		FullEnglishTranslation: verse.FullTranslation,
	}

	// If uncompounded text is not available, we need to generate it
	// For now, we'll return what we have - the frontend can call /split endpoint first
	if data.UncompoundedText == "" {
		// This is acceptable - the agent will work with what's available
		// The frontend should ensure split data exists before starting conversation
	}

	return data, nil
}

// corpusRegistry maps corpus names to their providers
var corpusRegistry = make(map[string]CorpusDataProvider)

// RegisterCorpusProvider registers a corpus data provider
func RegisterCorpusProvider(name string, provider CorpusDataProvider) {
	corpusRegistry[name] = provider
}

// GetCorpusProvider retrieves a corpus provider by name
func GetCorpusProvider(name string) (CorpusDataProvider, error) {
	provider, ok := corpusRegistry[name]
	if !ok {
		return nil, fmt.Errorf("corpus provider not found: %s", name)
	}
	return provider, nil
}

// init registers the default corpus providers
func init() {
	RegisterCorpusProvider("subhashita", &SubhashitaDataProvider{})
	// Future: RegisterCorpusProvider("ramayana", &RamayanaDataProvider{})
	// Future: RegisterCorpusProvider("bhagavad_gita", &BhagavadGitaDataProvider{})
}
