package parser

import (
	"encoding/xml"
)

type TokenType string

const StartElement TokenType = "Start"
const EndElement TokenType = "End"
const CharData TokenType = "CharData"

const PartOfSpeech = "ab"
const MeaningMarker = "b"

type DictionaryEntryToken struct {
	Token   xml.Token
	Typ     TokenType
	Content string
}

type DictionaryEntryTokens []*DictionaryEntryToken

func (tokens DictionaryEntryTokens) GetPartOfSpeech() string {
	for i, tok := range tokens {
		if tok.Typ == StartElement && tok.Content == PartOfSpeech {
			if i+1 < len(tokens) {
				return tokens[i+1].Content
			}
		}
	}

	return ""
}

func (tokens DictionaryEntryTokens) GetMeanings() []string {
	var ind int
	for _, tok := range tokens {
		if tok.Typ == StartElement && tok.Content == PartOfSpeech {
			break
		}

		ind++
	}

	ind += 2
	var meanings []string

	for ind < len(tokens) {
		j := ind

		for j < len(tokens) {
			if tokens[j].Typ == MeaningMarker {
				break
			}

			j++
		}

		var meaning string
		for i := ind; i < j; i++ {
			if tokens[i].Typ == CharData {
				meaning += tokens[i].Content
			}
		}

		meanings = append(meanings, meaning)

		ind = j + 1
	}

	return meanings
}
