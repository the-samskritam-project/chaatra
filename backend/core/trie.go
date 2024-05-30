package core

import (
	"unicode"
)

var T *Trie

var D Dictionary

type Children map[rune]*Node

func (c Children) MatchWithoutCase(r rune) *Node {
	if n, ok := c[r]; ok {
		return n
	}

	if unicode.IsUpper(r) {
		lower := unicode.ToLower(r)
		if n, ok := c[lower]; ok {
			return n
		}
	}

	if unicode.IsLower(r) {
		upper := unicode.ToUpper(r)
		if n, ok := c[upper]; ok {
			return n
		}
	}

	return nil
}

type Node struct {
	Letter   *Letter
	Children Children
}

type Trie struct {
	Root *Node
}

func (t *Trie) Add(word []*Letter) {
	iterator := t.Root
	var reached int

	for _, letter := range word {
		if n, ok := iterator.Children[letter.Latin]; !ok {
			break
		} else {
			iterator = n
		}

		reached++
	}

	for i := reached; i < len(word); i++ {
		n := &Node{
			Letter:   word[i],
			Children: make(map[rune]*Node),
		}

		iterator.Children[n.Letter.Latin] = n
		iterator = n
	}
}

func (t *Trie) GetWordsForPrefixStrict(prefix []*Letter) []Word {
	iterator := t.Root
	reached := 0
	var results []Word

	for _, l := range prefix {
		if n, ok := iterator.Children[l.Latin]; !ok {
			break
		} else {
			iterator = n
		}

		reached++
	}

	if reached != len(prefix) {
		return []Word{}
	}

	results = depthFirst(iterator, prefix)

	return results
}

func (t *Trie) GetWordsForPrefixFuzzy(prefix Word) []Word {
	iterator := t.Root
	reached := 0
	var results []Word

	var matched string
	for _, l := range prefix {
		if n := iterator.Children.MatchWithoutCase(l.Latin); n != nil {
			iterator = n
			matched = matched + string(n.Letter.Latin)
		} else {
			break
		}

		reached++
	}

	results = depthFirst(iterator, GetTokens(matched))

	return results
}

func depthFirst(n *Node, str Word) []Word {
	var results []Word

	if len(n.Children) == 0 {
		results = append(results, str)

		return results
	}

	for _, v := range n.Children {
		newStr := append(Word(nil), str...)
		newStr = append(newStr, v.Letter)

		results = append(results, depthFirst(v, newStr)...)
	}

	return results
}
