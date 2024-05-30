package service

import "chaatra/core"

type LookupReq struct {
	Slp1 string
	Dev  string
}

func AutoComplete(req LookupReq) {
	var letters []*core.Letter
	for _, c := range req.Slp1 {
		l := core.TheAlphabet[string(c)]

		letters = append(letters, &l)
	}

	words := core.T.GetWordsForPrefixFuzzy(letters)

	entries := make([]*core.Entry, 0)

	for _, res := range words {
		devanagariWord := core.StringifyTokens(res)

		if e, ok := core.D[devanagariWord]; ok {
			entries = append(entries, e)
		}
	}
}
