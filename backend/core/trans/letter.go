package trans

type Letter struct {
	// Check out the transliteration scheme : https://en.wikipedia.org/wiki/SLP1
	Latin      rune
	Devanagari rune
	Typ        AlphabetType
}

type Word []*Letter

func (w Word) Devanagari() string {
	return StringifyTokens(w)
}
