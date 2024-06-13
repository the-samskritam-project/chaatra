package parser

type Entry struct {
	DevanagariWord     string `json:"devanagariWord"`
	TransliteratedWord string `json:"transliteratedWord"`
	EnglishMeaning     string `json:"englishMeaning"`
}

type Dictionary map[string]*Entry
