package core

import (
	"fmt"
	"log"
	"testing"
)

func Test_TrieAdd(t *testing.T) {
	trie := Trie{
		Root: &Node{
			Letter: &Letter{
				Devanagari: ' ',
			},
			Children: make(map[rune]*Node),
		},
	}

	tokens := GetTokens("svaDitiH")
	trie.Add(tokens)

	tokens = GetTokens("pariGawwanaM")
	trie.Add(tokens)

	tokens = GetTokens("kanaKala")
	trie.Add(tokens)

	tokens = GetTokens("kapiSA")
	trie.Add(tokens)

	tokens = GetTokens("kaliMga")
	trie.Add(tokens)

	tokens = GetTokens("kAMcI")
	trie.Add(tokens)

	tokens = GetTokens("kAmarUpa")
	trie.Add(tokens)

	tokens = GetTokens("ahaM")
	trie.Add(tokens)

	l1 := TheAlphabet["a"]

	results := trie.GetWordsForPrefixStrict([]*Letter{&l1})

	for _, res := range results {
		var word string
		for _, r := range res {
			word = fmt.Sprintf("%s%c", word, r.Latin)
		}

		log.Println(word)
	}
}

func TestMatchWithoutCase(t *testing.T) {
	testChildren := Children{
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
	trie := Trie{
		Root: &Node{
			Letter: &Letter{
				Devanagari: ' ',
			},
			Children: make(map[rune]*Node),
		},
	}

	tokens := GetTokens("svaDitiH")
	trie.Add(tokens)

	tokens = GetTokens("pariGawwanaM")
	trie.Add(tokens)

	tokens = GetTokens("kanaKala")
	trie.Add(tokens)

	tokens = GetTokens("kapiSA")
	trie.Add(tokens)

	tokens = GetTokens("kaliMga")
	trie.Add(tokens)

	tokens = GetTokens("kAncI")
	trie.Add(tokens)

	tokens = GetTokens("kAmarUpa")
	trie.Add(tokens)

	tokens = GetTokens("aham")
	trie.Add(tokens)

	testCases := []struct {
		inputSlp1Str []*Letter
		expected     map[string]bool
	}{
		{
			inputSlp1Str: []*Letter{{Latin: 'k'}, {Latin: 'a'}},
			expected:     map[string]bool{"kanaKala": true, "kapiSA": true, "kaliMga": true},
		},
		{
			inputSlp1Str: []*Letter{{Latin: 'k'}, {Latin: 'A'}},
			expected:     map[string]bool{"kAmarUpa": true, "kAncI": true},
		},
		{
			inputSlp1Str: []*Letter{{Latin: 'a'}, {Latin: 'h'}, {Latin: 'a'}, {Latin: 'M'}},
			expected:     map[string]bool{"aham": true},
		},
		{
			inputSlp1Str: []*Letter{{Latin: 'k'}, {Latin: 'a'}, {Latin: 'l'}, {Latin: 'I'}},
			expected:     map[string]bool{"kaliMga": true},
		},
	}

	for _, testCase := range testCases {
		results := trie.GetWordsForPrefixFuzzy(testCase.inputSlp1Str)

		if len(results) != len(testCase.expected) {
			t.Errorf("For : Expecting %d results, but got %d", len(testCase.expected), len(results))
		}

		for _, res := range results {
			var actual string
			for _, l := range res {
				actual = actual + string(l.Latin)
			}

			if _, ok := testCase.expected[actual]; !ok {
				t.Fatalf("Got %s, which is not in the expected set %v", actual, testCase.expected)
			}
		}
	}
}
