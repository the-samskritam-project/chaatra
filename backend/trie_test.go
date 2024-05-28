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

	tokens = getTokens("ahaM")
	trie.add(tokens)

	l1 := theAlphabet["a"]

	results := trie.getWordsForPrefixStrict([]*letter{&l1})

	for _, res := range results {
		var word string
		for _, r := range res {
			word = fmt.Sprintf("%s%c", word, r.latin)
		}

		log.Println(word)
	}
}

func TestMatchWithoutCase(t *testing.T) {
	testChildren := children{
		'a': {},
		'B': {},
		'C': {},
		'd': {},
	}

	runesToTest := []rune{'A', 'b', 'c', 'D'}

	for _, c := range runesToTest {
		if r := testChildren.MatchWithoutCase(c); r == nil {
			t.Errorf("Expecting %c to be found, but was not", c)
		}
	}
}

func TestFuzzy(t *testing.T) {
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

	tokens = getTokens("kAncI")
	trie.add(tokens)

	tokens = getTokens("kAmarUpa")
	trie.add(tokens)

	tokens = getTokens("aham")
	trie.add(tokens)

	testCases := []struct {
		inputSlp1Str []*letter
		expected     map[string]bool
	}{
		{
			inputSlp1Str: []*letter{{latin: 'k'}, {latin: 'a'}},
			expected:     map[string]bool{"kanaKala": true, "kapiSA": true, "kaliMga": true},
		},
		{
			inputSlp1Str: []*letter{{latin: 'k'}, {latin: 'A'}},
			expected:     map[string]bool{"kAmarUpa": true, "kAncI": true},
		},
		{
			inputSlp1Str: []*letter{{latin: 'a'}, {latin: 'h'}, {latin: 'a'}, {latin: 'M'}},
			expected:     map[string]bool{"aham": true},
		},
		{
			inputSlp1Str: []*letter{{latin: 'k'}, {latin: 'a'}, {latin: 'l'}, {latin: 'I'}},
			expected:     map[string]bool{"kaliMga": true},
		},
	}

	for _, testCase := range testCases {
		results := trie.getWordsForPrefixFuzzy(testCase.inputSlp1Str)

		if len(results) != len(testCase.expected) {
			t.Errorf("For : Expecting %d results, but got %d", len(testCase.expected), len(results))
		}

		for _, res := range results {
			var actual string
			for _, l := range res {
				actual = actual + string(l.latin)
			}

			if _, ok := testCase.expected[actual]; !ok {
				t.Fatalf("Got %s, which is not in the expected set %v", actual, testCase.expected)
			}
		}
	}
}
