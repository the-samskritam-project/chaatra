package main

import (
	"encoding/xml"
	"fmt"
	"log"
	"testing"
)

func TestParse(t *testing.T) {
	trie := trie{
		root: &node{
			letter: &letter{
				devanagari: ' ',
			},
			children: make(map[rune]*node),
		},
	}

	parse(&trie)

	l1 := theAlphabet["t"]
	l2 := theAlphabet["a"]

	results := trie.getWordsForPrefixStrict([]*letter{&l1, &l2})

	for _, res := range results {
		var lat string
		for _, r := range res {
			lat = fmt.Sprintf("%s%c", lat, r.latin)
		}

		log.Printf("%s : %s", lat, stringifyTokens(res))
	}
}

func TestUnmarshallBody(t *testing.T) {
	xmlData := `<H1><h><key1>akzarI</key1><key2>akzarI</key2></h><body><s>akzarI</s>  [<s>aSnute gaganABogaM meGEH</s>; <lbinfo n="aS#saran"/> <s>aSsaran, gOrA° NIz</s>] The rainy season.</body><tail><L>137</L><pc>0008-a</pc></tail></H1>`

	var h1 H1
	if err := xml.Unmarshal([]byte(xmlData), &h1); err != nil {
		fmt.Println("Error unmarshaling XML:", err)
		return
	}
}
