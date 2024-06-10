package parser

import (
	"chaatra/core/trans"
	"encoding/xml"
	"fmt"
	"testing"
)

func TestParse(t *testing.T) {
	trie := trans.Trie{
		Root: &trans.Node{
			Letter: &trans.Letter{
				Devanagari: ' ',
			},
			Children: make(map[rune]*trans.Node),
		},
	}

	Parse(&trie)

	l1 := trans.TheAlphabet["t"]
	l2 := trans.TheAlphabet["a"]

	results := trie.GetWordsForPrefixStrict([]*trans.Letter{&l1, &l2})

	for _, res := range results {
		var lat string
		for _, r := range res {
			lat = fmt.Sprintf("%s%c", lat, r.Latin)
		}
	}
}

func TestUnmarshallBody(t *testing.T) {
	xmlData := `<H1><h><key1>akzarI</key1><key2>akzarI</key2></h><body><s>akzarI</s>  [<s>aSnute gaganABogaM meGEH</s>; <lbinfo n="aS#saran"/> <s>aSsaran, gOrA° NIz</s>] The rainy season.</body><tail><L>137</L><pc>0008-a</pc></tail></H1>`

	var h1 H1
	if err := xml.Unmarshal([]byte(xmlData), &h1); err != nil {
		t.Fatalf("Error unmarshaling XML: %s", err.Error())
		return
	}
}
