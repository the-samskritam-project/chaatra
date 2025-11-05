package parser

type Entry struct {
	DevanagariWord     string                 `json:"devanagariWord"`
	TransliteratedWord string                 `json:"transliteratedWord"`
	EnglishMeaning     string                 `json:"englishMeaning"`
	Metadata           map[string]interface{} `json:"metadata,omitempty"`
}

type Dictionary map[string]*Entry
