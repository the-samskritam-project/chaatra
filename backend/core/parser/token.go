package parser

import (
	"chaatra/core/trans"
	"encoding/xml"
	"strings"
	"unicode"
)

type TokenType string

const StartElement TokenType = "Start"
const EndElement TokenType = "End"
const CharData TokenType = "CharData"

const PartOfSpeech = "ab"
const MeaningMarker = "b"
const SanskritText = "s"

const Comma = ","
const Dash = "-"
const Space = " "

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

	var meanings []string

	for ind < len(tokens) {
		j := ind

		for j < len(tokens) {
			if tokens[j].Typ == StartElement && tokens[j].Content == MeaningMarker {
				break
			}

			j++
		}

		var meaning string
		for i := ind; i < j; i++ {
			if tokens[i].Typ == CharData {
				if i-1 >= 0 &&
					tokens[i-1].Typ == StartElement &&
					tokens[i-1].Content == SanskritText {
					meaning += getSanskritText(tokens[i].Content)
				} else {
					meaning += tokens[i].Content
				}
			}
		}

		if meaning != "" {
			meanings = append(meanings, reduceSpaces(meaning))
		}

		ind = j + 1
	}

	return meanings
}

func getSanskritText(str string) string {
	str = strings.TrimSpace(str)

	var result string
	if strings.Contains(str, Comma) {
		splitByComma := strings.Split(str, Comma)

		for i, subStr := range splitByComma {
			if strings.Contains(subStr, Dash) {
				result += splitByX(subStr, Dash)
			} else {
				subStr = strings.TrimSpace(subStr)
				result += trans.Trans(subStr)
			}

			if i != len(splitByComma)-1 {
				result += Comma + Space
			}
		}
	} else if strings.Contains(str, Space) {
		result += splitByX(str, Space)
	} else {
		result = trans.Trans(str)
	}

	return result
}

func splitByX(str, byX string) string {
	str = strings.TrimSpace(str)

	subStrs := strings.Split(str, byX)

	var result string
	for i, subStr := range subStrs {
		result += trans.Trans(subStr)

		if i < len(subStrs)-1 {
			result += byX
		}
	}

	return result
}

func reduceSpaces(input string) string {
	var b strings.Builder
	space := false

	for _, r := range input {
		if unicode.IsSpace(r) {
			if !space {
				b.WriteRune(' ')
				space = true
			}
		} else {
			b.WriteRune(r)
			space = false
		}
	}

	return b.String()
}
