package main

import (
	"fmt"
	"log"
	"testing"
)

func Test_TrieAdd(t *testing.T) {
	trie := trie{
		root: &node{
			letter: &letter{
				devanagari: ' ',
			},
			children: make(map[rune]*node),
		},
	}

	tokens := getTokens("svaDitiH")
	trie.add(tokens)

	tokens = getTokens("pariGawwanaM")
	trie.add(tokens)

	tokens = getTokens("kanaKala")
	trie.add(tokens)

	tokens = getTokens("kapiSA")
	trie.add(tokens)

	tokens = getTokens("kaliMga")
	trie.add(tokens)

	tokens = getTokens("kAMcI")
	trie.add(tokens)

	tokens = getTokens("kAmarUpa")
	trie.add(tokens)

	l1 := theAlphabet["k"]
	l2 := theAlphabet["a"]
	l3 := theAlphabet["l"]

	results := trie.getWordsForPrefix([]*letter{&l1, &l2, &l3})

	for _, res := range results {
		var word string
		for _, r := range res {
			word = fmt.Sprintf("%s%c", word, r.latin)
		}

		log.Println(word)
	}
}
