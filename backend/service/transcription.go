package service

import (
	"strings"
	"unicode"
)

// ConvertIASTToDevanagari converts IAST (International Alphabet of Sanskrit Transliteration) text to Devanagari script
func ConvertIASTToDevanagari(iastText string) string {
	if iastText == "" {
		return ""
	}

	// Check if text is already in Devanagari (contains Devanagari Unicode range)
	isDevanagari := false
	for _, r := range iastText {
		if r >= 0x0900 && r <= 0x097F {
			isDevanagari = true
			break
		}
	}
	if isDevanagari {
		return iastText
	}

	// IAST to Devanagari mapping
	vowels := map[string]string{
		"a":  "अ",
		"ā":  "आ",
		"i":  "इ",
		"ī":  "ई",
		"u":  "उ",
		"ū":  "ऊ",
		"ṛ":  "ऋ",
		"ṝ":  "ॠ",
		"ḷ":  "ऌ",
		"ḹ":  "ॡ",
		"e":  "ए",
		"ai": "ऐ",
		"o":  "ओ",
		"au": "औ",
	}

	vowelSigns := map[string]string{
		"ā":  "ा",
		"i":  "ि",
		"ī":  "ी",
		"u":  "ु",
		"ū":  "ू",
		"ṛ":  "ृ",
		"ṝ":  "ॄ",
		"ḷ":  "ॢ",
		"ḹ":  "ॣ",
		"e":  "े",
		"ai": "ै",
		"o":  "ो",
		"au": "ौ",
	}

	consonants := map[string]string{
		"k":  "क",
		"kh": "ख",
		"g":  "ग",
		"gh": "घ",
		"ṅ":  "ङ",
		"c":  "च",
		"ch": "छ",
		"j":  "ज",
		"jh": "झ",
		"ñ":  "ञ",
		"ṭ":  "ट",
		"ṭh": "ठ",
		"ḍ":  "ड",
		"ḍh": "ढ",
		"ṇ":  "ण",
		"t":  "त",
		"th": "थ",
		"d":  "द",
		"dh": "ध",
		"n":  "न",
		"p":  "प",
		"ph": "फ",
		"b":  "ब",
		"bh": "भ",
		"m":  "म",
		"y":  "य",
		"r":  "र",
		"l":  "ल",
		"v":  "व",
		"ś":  "श",
		"ṣ":  "ष",
		"s":  "स",
		"h":  "ह",
	}

	diacritics := map[string]string{
		"ṃ": "ं", // anusvara
		"ḥ": "ः", // visarga
		"ऽ": "ऽ", // avagraha
	}

	virama := "्"
	result := strings.Builder{}
	runes := []rune(iastText)
	i := 0

	for i < len(runes) {
		char := runes[i]

		// Handle spaces and punctuation
		if unicode.IsSpace(char) || isPunctuation(char) {
			result.WriteRune(char)
			i++
			continue
		}

		// Try to match longest sequences first (e.g., "ai", "au", "ṭh", "ḍh", "ch", "th", "dh", "bh", "gh", "kh", "ph", "jh", "ch")
		matched := false

		// Check for two-character sequences (vowels and consonants)
		if i+1 < len(runes) {
			twoChar := string(runes[i : i+2])
			if dev, ok := vowels[twoChar]; ok {
				result.WriteString(dev)
				i += 2
				matched = true
			} else if dev, ok := consonants[twoChar]; ok {
				// Check if next character is a vowel
				if i+2 < len(runes) {
					nextChar := string(runes[i+2])
					if vowelSign, ok := vowelSigns[nextChar]; ok {
						result.WriteString(dev)
						result.WriteString(vowelSign)
						i += 3
						matched = true
					} else if nextChar == "a" {
						result.WriteString(dev)
						i += 3
						matched = true
					}
				}
				if !matched {
					// Check if next is consonant or end
					if i+2 >= len(runes) || (i+2 < len(runes) && isConsonant(string(runes[i+2]))) {
						result.WriteString(dev)
						result.WriteString(virama)
						i += 2
						matched = true
					} else {
						result.WriteString(dev)
						i += 2
						matched = true
					}
				}
			}
		}

		// Check for single character
		if !matched {
			singleChar := string(char)
			if dev, ok := vowels[singleChar]; ok {
				result.WriteString(dev)
				i++
			} else if dev, ok := consonants[singleChar]; ok {
				// Check if next character is a vowel
				if i+1 < len(runes) {
					nextChar := string(runes[i+1])
					if vowelSign, ok := vowelSigns[nextChar]; ok {
						result.WriteString(dev)
						result.WriteString(vowelSign)
						i += 2
					} else if nextChar == "a" {
						result.WriteString(dev)
						i += 2
					} else if isConsonant(nextChar) {
						result.WriteString(dev)
						result.WriteString(virama)
						i++
					} else {
						result.WriteString(dev)
						result.WriteString(virama)
						i++
					}
				} else {
					// Last character, add virama
					result.WriteString(dev)
					result.WriteString(virama)
					i++
				}
			} else if dev, ok := diacritics[singleChar]; ok {
				result.WriteString(dev)
				i++
			} else {
				// Unknown character, write as-is
				result.WriteRune(char)
				i++
			}
		}
	}

	return result.String()
}

// isConsonant checks if a character is a Sanskrit consonant in IAST
func isConsonant(s string) bool {
	consonants := []string{"k", "kh", "g", "gh", "ṅ", "c", "ch", "j", "jh", "ñ", "ṭ", "ṭh", "ḍ", "ḍh", "ṇ", "t", "th", "d", "dh", "n", "p", "ph", "b", "bh", "m", "y", "r", "l", "v", "ś", "ṣ", "s", "h"}
	for _, c := range consonants {
		if strings.HasPrefix(s, c) {
			return true
		}
	}
	return false
}

// isPunctuation checks if a rune is a punctuation mark
func isPunctuation(r rune) bool {
	return (r >= 0x0021 && r <= 0x002F) ||
		(r >= 0x003A && r <= 0x0040) ||
		(r >= 0x005B && r <= 0x0060) ||
		(r >= 0x007B && r <= 0x007E) ||
		(r >= 0x2000 && r <= 0x206F) ||
		(r >= 0x3000 && r <= 0x303F) ||
		(r >= 0xFE30 && r <= 0xFE4F) ||
		(r >= 0xFE50 && r <= 0xFE6F) ||
		(r >= 0xFF00 && r <= 0xFF0F) ||
		(r >= 0xFF1A && r <= 0xFF20) ||
		(r >= 0xFF3B && r <= 0xFF40) ||
		(r >= 0xFF5B && r <= 0xFF65)
}
