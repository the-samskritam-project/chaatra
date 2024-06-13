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

func ParseApteDictionary(path string) (map[string]*parser.DictionaryEntry, error) {
	parsr := parser.NewParser()

	entries, err := parsr.ParseFullDictionary(path)
	if err != nil {
		return nil, fmt.Errorf("error parsing the apte dictionary : %s", err.Error())
	}

	dictionary := make(map[string]*parser.DictionaryEntry, len(entries))

	for _, entry := range entries {
		dictionary[entry.Word] = entry
	}

	return dictionary, nil
}

func BuildTrie(entries map[string]*parser.DictionaryEntry) *trans.Trie {
	trie := &trans.Trie{
		Root: &trans.Node{
			Letter: &trans.Letter{
				Devanagari: '*',
			},
			Children: make(map[rune]*trans.Node),
		},
	}

	var processed int
	for entry := range entries {
		trie.Add(trans.GetTokens(entry))
		processed++
	}

	log.Println("processed : ", processed, " records")

	return trie
}

func LookupPrefixes(trie *trans.Trie, slp1 string) []trans.Word {
	return trie.GetWordsForPrefixStrict(trans.GetTokens(slp1))
}
