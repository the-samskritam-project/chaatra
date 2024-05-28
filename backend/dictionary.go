package main

type Entry struct {
	DevanagariWord     string `json:"devanagariWord"`
	TransliteratedWord string `json:"transliteratedWord"`
	EnglishMeaning     string `json:"englishMeaning"`
}

type dictionary map[string]*Entry
