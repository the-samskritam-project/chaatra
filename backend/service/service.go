package service

import (
	"chaatra/core/parser"
	"chaatra/core/trans"
	"chaatra/helpers"
	"fmt"
	"log"
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

func ParseApteDictionary(path string) ([]*parser.DictionaryEntry, error) {
	parser := parser.NewParser()

	results, err := parser.ParseFullDictionary(path)
	if err != nil {
		return nil, fmt.Errorf("error parsing the apte dictionary : %s", err.Error())
	}

	return results, nil
}

func BuildTrie(entries []*parser.DictionaryEntry) *trans.Trie {
	trie := &trans.Trie{
		Root: &trans.Node{
			Letter: &trans.Letter{
				Devanagari: '*',
			},
			Children: make(map[rune]*trans.Node),
		},
	}

	var processed int
	for _, entry := range entries {
		trie.Add(trans.GetTokens(entry.Word))
		processed++
	}

	log.Println("processed : ", processed, " records")

	return trie
}

func TransliterateAndLookup(trie *trans.Trie, slp1 string) []trans.Word {
	return trie.GetWordsForPrefixStrict(trans.GetTokens(slp1))
}
