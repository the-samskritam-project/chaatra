package trans

import (
	"fmt"
)

type AlphabetType string

const vowel AlphabetType = "Vowel"

const consonant AlphabetType = "Consonant"

const halfConsonant = '्'

const a rune = 'अ'

var TheAlphabet = map[string]Letter{
	// Vowels
	"a": {Latin: 'a', Devanagari: 'अ', Typ: vowel}, "A": {Latin: 'A', Devanagari: 'आ', Typ: vowel}, "i": {Latin: 'i', Devanagari: 'इ', Typ: vowel},
	"I": {Latin: 'I', Devanagari: 'ई', Typ: vowel}, "u": {Latin: 'u', Devanagari: 'उ', Typ: vowel}, "U": {Latin: 'U', Devanagari: 'ऊ', Typ: vowel},
	"f": {Latin: 'f', Devanagari: 'ऋ', Typ: vowel}, "F": {Latin: 'F', Devanagari: 'ॠ', Typ: vowel}, "x": {Latin: 'x', Devanagari: 'ऌ', Typ: vowel},
	"X": {Latin: 'X', Devanagari: 'ॡ', Typ: vowel}, "e": {Latin: 'e', Devanagari: 'ए', Typ: vowel}, "E": {Latin: 'E', Devanagari: 'ऐ', Typ: vowel},
	"o": {Latin: 'o', Devanagari: 'ओ', Typ: vowel}, "O": {Latin: 'O', Devanagari: 'औ', Typ: vowel}, "M": {Latin: 'M', Devanagari: 'ं', Typ: vowel},
	"H": {Latin: 'H', Devanagari: 'ः', Typ: vowel},

	// Consonants
	"k": {Latin: 'k', Devanagari: 'क', Typ: consonant}, "K": {Latin: 'K', Devanagari: 'ख', Typ: consonant}, "g": {Latin: 'g', Devanagari: 'ग', Typ: consonant},
	"G": {Latin: 'G', Devanagari: 'घ', Typ: consonant}, "N": {Latin: 'N', Devanagari: 'ङ', Typ: consonant}, "c": {Latin: 'c', Devanagari: 'च', Typ: consonant},
	"C": {Latin: 'C', Devanagari: 'छ', Typ: consonant}, "j": {Latin: 'j', Devanagari: 'ज', Typ: consonant}, "J": {Latin: 'J', Devanagari: 'झ', Typ: consonant},
	"Y": {Latin: 'Y', Devanagari: 'ञ', Typ: consonant}, "w": {Latin: 'w', Devanagari: 'ट', Typ: consonant}, "W": {Latin: 'W', Devanagari: 'ठ', Typ: consonant},
	"q": {Latin: 'q', Devanagari: 'ड', Typ: consonant}, "Q": {Latin: 'Q', Devanagari: 'ढ', Typ: consonant}, "R": {Latin: 'R', Devanagari: 'ण', Typ: consonant},
	"t": {Latin: 't', Devanagari: 'त', Typ: consonant}, "T": {Latin: 'T', Devanagari: 'थ', Typ: consonant}, "d": {Latin: 'd', Devanagari: 'द', Typ: consonant},
	"D": {Latin: 'D', Devanagari: 'ध', Typ: consonant}, "n": {Latin: 'n', Devanagari: 'न', Typ: consonant}, "p": {Latin: 'p', Devanagari: 'प', Typ: consonant},
	"P": {Latin: 'P', Devanagari: 'फ', Typ: consonant}, "b": {Latin: 'b', Devanagari: 'ब', Typ: consonant}, "B": {Latin: 'B', Devanagari: 'भ', Typ: consonant},
	"m": {Latin: 'm', Devanagari: 'म', Typ: consonant}, "y": {Latin: 'y', Devanagari: 'य', Typ: consonant}, "r": {Latin: 'r', Devanagari: 'र', Typ: consonant},
	"l": {Latin: 'l', Devanagari: 'ल', Typ: consonant}, "v": {Latin: 'v', Devanagari: 'व', Typ: consonant}, "S": {Latin: 'S', Devanagari: 'श', Typ: consonant},
	"z": {Latin: 'z', Devanagari: 'ष', Typ: consonant}, "s": {Latin: 's', Devanagari: 'स', Typ: consonant}, "h": {Latin: 'h', Devanagari: 'ह', Typ: consonant},
}

var vowelSigns = map[string]rune{
	"आ": 'ा', "इ": 'ि', "ई": 'ी',
	"उ": 'ु', "ऊ": 'ू', "ऋ": 'ृ',
	"ॠ": 'ॄ', "ऌ": 'ॢ', "ॡ": 'ॣ',
	"ए": 'े', "ऐ": 'ै', "ओ": 'ो',
	"औ": 'ौ', "ं": 'ं', ":": 'ः',
}

func GetTokens(text string) Word {
	i, l := 0, len(text)

	tokens := make([]*Letter, 0)

	for i < l {
		oneRuneToken := fmt.Sprintf("%c", text[i])

		if tokenVal, ok := TheAlphabet[oneRuneToken]; ok {
			tokens = append(tokens, &tokenVal)
			i++
			continue
		}

		i++
	}

	return tokens
}

func StringifyTokens(tokens []*Letter) string {
	var result []rune
	i := 0

	for i < len(tokens) {
		if tokens[i].Typ == vowel {
			result = append(result, tokens[i].Devanagari)
			i++

			continue
		}

		if tokens[i].Typ == consonant {
			result = append(result, tokens[i].Devanagari)

			j := i + 1

			for j < len(tokens) && tokens[j].Typ == consonant {
				// half consonant
				result = append(result, halfConsonant)
				result = append(result, tokens[j].Devanagari)
				j++
			}

			if j < len(tokens) {
				if tokens[j].Typ == vowel {
					if tokens[j].Devanagari != a {
						result = append(
							result,
							vowelSigns[string(tokens[j].Devanagari)],
						)
					}
				}
			}

			i = j
		}

		i++
	}

	if l := len(tokens); l > 0 && tokens[l-1].Typ == consonant {
		result = append(result, halfConsonant)
	}

	return string(result)
}

func Trans(text string) string {
	return StringifyTokens(GetTokens(text))
}
