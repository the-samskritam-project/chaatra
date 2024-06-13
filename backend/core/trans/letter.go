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

func (w Word) LatinSLP1() string {
	var slp1 string

	for _, l := range w {
		slp1 += string(l.Latin)
	}

	return slp1
}
