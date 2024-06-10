package service

import (
	"chaatra/core/trans"
	"chaatra/helpers"
)

type LookupReq struct {
	Slp1 string
	Dev  string
}

func AutoComplete(req LookupReq) []string {
	var reqStr trans.Word
	for _, c := range req.Slp1 {
		l := trans.TheAlphabet[string(c)]

		reqStr = append(reqStr, &l)
	}

	matches := trans.T.GetWordsForPrefixFuzzy(reqStr)

	var candidates []string
	for _, w := range matches {
		candidates = append(candidates, w.Devanagari())
	}

	return helpers.SortByCloseness(
		reqStr.Devanagari(),
		candidates)
}
