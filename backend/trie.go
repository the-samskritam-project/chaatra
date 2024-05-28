package main

import (
	"unicode"
)

type children map[rune]*node

func (c children) MatchWithoutCase(r rune) *node {
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

type node struct {
	letter   *letter
	children children
}

type trie struct {
	root *node
}

func (t *trie) add(word []*letter) {
	iterator := t.root
	var reached int

	for _, letter := range word {
		if n, ok := iterator.children[letter.latin]; !ok {
			break
		} else {
			iterator = n
		}

		reached++
	}

	for i := reached; i < len(word); i++ {
		n := &node{
			letter:   word[i],
			children: make(map[rune]*node),
		}

		iterator.children[n.letter.latin] = n
		iterator = n
	}
}

func (t *trie) getWordsForPrefixStrict(prefix []*letter) [][]*letter {
	iterator := t.root
	reached := 0
	var results [][]*letter

	for _, l := range prefix {
		if n, ok := iterator.children[l.latin]; !ok {
			break
		} else {
			iterator = n
		}

		reached++
	}

	if reached != len(prefix) {
		return [][]*letter{}
	}

	results = depthFirst(iterator, prefix)

	return results
}

func (t *trie) getWordsForPrefixFuzzy(prefix []*letter) [][]*letter {
	iterator := t.root
	reached := 0
	var results [][]*letter

	var matched string
	for _, l := range prefix {
		if n := iterator.children.MatchWithoutCase(l.latin); n != nil {
			iterator = n
			matched = matched + string(n.letter.latin)
		} else {
			break
		}

		reached++
	}

	results = depthFirst(iterator, getTokens(matched))

	return results
}

func depthFirst(n *node, str []*letter) [][]*letter {
	var results [][]*letter

	if len(n.children) == 0 {
		results = append(results, str)

		return results
	}

	for _, v := range n.children {
		newStr := append([]*letter(nil), str...)
		newStr = append(newStr, v.letter)

		results = append(results, depthFirst(v, newStr)...)
	}

	return results
}
