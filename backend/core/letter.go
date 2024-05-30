package core

type Letter struct {
	// Check out the transliteration scheme : https://en.wikipedia.org/wiki/SLP1
	Latin      rune
	Devanagari rune
	Typ        AlphabetType
}

type Word []*Letter

func (w Word) Devanagari() string {
	var dev string
	for _, l := range w {
		dev = dev + string(l.Devanagari)
	}

	return dev
}
