package trans

import (
	"testing"
)

func TestAdd(t *testing.T) {
	var testCases = []struct {
		words []string
	}{
		{
			words: []string{
				"lal", "lala", "lalat", "lalanaM",
				"lalanA", "lalanikA", "lalaMtikA", "lalAkaH", "lalAwaM",
				"lalAwakaM", "lalAwaMtapa", "lalAwikA", "lalAwUla",
				"lalAma", "lalAmakaM", "lalAman", "lalita", "lalitA",
			},
		},
	}

	for _, testCase := range testCases {
		trie := Trie{
			Root: &Node{
				Letter: &Letter{
					Devanagari: ' ',
				},
				Children: make(map[rune]*Node),
			},
		}

		contains := func(str string, words []Word) bool {
			for _, word := range words {
				if str == word.LatinSLP1() {
					return true
				}
			}

			return false
		}

		for _, word := range testCase.words {
			tokens := GetTokens(word)
			trie.Add(tokens)
		}

		for _, word := range testCase.words {
			tokens := GetTokens(word)

			found := trie.GetWordsForPrefixStrict(tokens)
			if len(found) == 0 {
				t.Errorf("Expected to find '%s' in the trie, but did the array was empty", word)
			} else if !contains(word, found) {
				t.Errorf("Expected to find '%s' in the trie, but the word was not found in the results", word)
			}
		}
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
