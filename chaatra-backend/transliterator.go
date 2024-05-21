package main

import (
	"fmt"
)

type alphabetType string

const vowel alphabetType = "Vowel"

const consonant alphabetType = "Consonant"

const halfConsonant = '्'

const a rune = 'अ'

type letter struct {
	// Check out the transliteration scheme : https://en.wikipedia.org/wiki/SLP1
	latin      rune
	devanagari rune
	typ        alphabetType
}

var theAlphabet = map[string]letter{
	// Vowels
	"a": {latin: 'a', devanagari: 'अ', typ: vowel}, "A": {latin: 'A', devanagari: 'आ', typ: vowel}, "i": {latin: 'i', devanagari: 'इ', typ: vowel},
	"I": {latin: 'I', devanagari: 'ई', typ: vowel}, "u": {latin: 'u', devanagari: 'उ', typ: vowel}, "U": {latin: 'U', devanagari: 'ऊ', typ: vowel},
	"f": {latin: 'f', devanagari: 'ऋ', typ: vowel}, "F": {latin: 'F', devanagari: 'ॠ', typ: vowel}, "x": {latin: 'x', devanagari: 'ऌ', typ: vowel},
	"X": {latin: 'X', devanagari: 'ॡ', typ: vowel}, "e": {latin: 'e', devanagari: 'ए', typ: vowel}, "E": {latin: 'E', devanagari: 'ऐ', typ: vowel},
	"o": {latin: 'o', devanagari: 'ओ', typ: vowel}, "O": {latin: 'O', devanagari: 'औ', typ: vowel}, "M": {latin: 'M', devanagari: 'ं', typ: vowel},
	"H": {latin: 'H', devanagari: 'ः', typ: vowel},

	// Consonants
	"k": {latin: 'k', devanagari: 'क', typ: consonant}, "K": {latin: 'K', devanagari: 'ख', typ: consonant}, "g": {latin: 'g', devanagari: 'ग', typ: consonant},
	"G": {latin: 'G', devanagari: 'घ', typ: consonant}, "N": {latin: 'N', devanagari: 'ङ', typ: consonant}, "c": {latin: 'c', devanagari: 'च', typ: consonant},
	"C": {latin: 'C', devanagari: 'छ', typ: consonant}, "j": {latin: 'j', devanagari: 'ज', typ: consonant}, "J": {latin: 'J', devanagari: 'झ', typ: consonant},
	"Y": {latin: 'Y', devanagari: 'ञ', typ: consonant}, "w": {latin: 'w', devanagari: 'ट', typ: consonant}, "W": {latin: 'W', devanagari: 'ठ', typ: consonant},
	"q": {latin: 'q', devanagari: 'ड', typ: consonant}, "Q": {latin: 'Q', devanagari: 'ढ', typ: consonant}, "R": {latin: 'R', devanagari: 'ण', typ: consonant},
	"t": {latin: 't', devanagari: 'त', typ: consonant}, "T": {latin: 'T', devanagari: 'थ', typ: consonant}, "d": {latin: 'd', devanagari: 'द', typ: consonant},
	"D": {latin: 'D', devanagari: 'ध', typ: consonant}, "n": {latin: 'n', devanagari: 'न', typ: consonant}, "p": {latin: 'p', devanagari: 'प', typ: consonant},
	"P": {latin: 'P', devanagari: 'फ', typ: consonant}, "b": {latin: 'b', devanagari: 'ब', typ: consonant}, "B": {latin: 'B', devanagari: 'भ', typ: consonant},
	"m": {latin: 'm', devanagari: 'म', typ: consonant}, "y": {latin: 'y', devanagari: 'य', typ: consonant}, "r": {latin: 'r', devanagari: 'र', typ: consonant},
	"l": {latin: 'l', devanagari: 'ल', typ: consonant}, "v": {latin: 'v', devanagari: 'व', typ: consonant}, "S": {latin: 'S', devanagari: 'श', typ: consonant},
	"z": {latin: 'z', devanagari: 'ष', typ: consonant}, "s": {latin: 's', devanagari: 'स', typ: consonant}, "h": {latin: 'h', devanagari: 'ह', typ: consonant},
}

var vowelSigns = map[string]rune{
	"आ": 'ा', "इ": 'ि', "ई": 'ी',
	"उ": 'ु', "ऊ": 'ू', "ऋ": 'ृ',
	"ॠ": 'ॄ', "ऌ": 'ॢ', "ॡ": 'ॣ',
	"ए": 'े', "ऐ": 'ै', "ओ": 'ो',
	"औ": 'ौ', "ं": 'ं', ":": 'ः',
}

func getTokens(text string) []*letter {
	i, l := 0, len(text)

	tokens := make([]*letter, 0)

	for i < l {
		oneRuneToken := fmt.Sprintf("%c", text[i])

		if tokenVal, ok := theAlphabet[oneRuneToken]; ok {
			tokens = append(tokens, &tokenVal)
			i++
			continue
		}

		i++
	}

	return tokens
}

func stringifyTokens(tokens []*letter) string {
	var result []rune
	i := 0

	for i < len(tokens) {
		if tokens[i].typ == vowel {
			result = append(result, tokens[i].devanagari)
			i++

			continue
		}

		if tokens[i].typ == consonant {
			result = append(result, tokens[i].devanagari)

			j := i + 1

			for j < len(tokens) && tokens[j].typ == consonant {
				// half consonant
				result = append(result, halfConsonant)
				result = append(result, tokens[j].devanagari)
				j++
			}

			if j < len(tokens) {
				if tokens[j].typ == vowel {
					if tokens[j].devanagari != a {
						result = append(
							result,
							vowelSigns[string(tokens[j].devanagari)],
						)
					}
				}
			}

			i = j
		}

		i++
	}

	return string(result)
}

func trans(text string) string {
	return stringifyTokens(getTokens(text))
}
