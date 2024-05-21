package main

type Entry struct {
	DevanagariWord     string `json:"devanagariWord"`
	TransliteratedWord string `json:"transliteratedWord"`
	EnglishMeaning     string `json:"englishMeaning"`
}

type dictionary map[string]*Entry

func (d *dictionary) add(e *Entry) {
	word := e.DevanagariWord

	if _, ok := (*d)[word]; !ok {
		(*d)[word] = e
	}
}
