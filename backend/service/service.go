package service

import (
	"chaatra/core"
	"chaatra/helpers"
)

type LookupReq struct {
	Slp1 string
	Dev  string
}

func AutoComplete(req LookupReq) []string {
	var reqStr core.Word
	for _, c := range req.Slp1 {
		l := core.TheAlphabet[string(c)]

		reqStr = append(reqStr, &l)
	}

	matches := core.T.GetWordsForPrefixFuzzy(reqStr)

	var candidates []string
	for _, w := range matches {
		candidates = append(candidates, w.Devanagari())
	}

	return helpers.SortByCloseness(
		reqStr.Devanagari(),
		candidates)
}
