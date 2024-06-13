package parser

import (
	"bufio"
	"encoding/xml"
	"fmt"
	"os"
	"regexp"
	"strings"
)

type DictionaryEntry struct {
	Word     string
	Type     string
	Meanings []string
}

type Parser interface {
	ParseFullDictionary(string) ([]*DictionaryEntry, error)
	ParseEntry(content string) (*DictionaryEntry, error)
}

type ApteParser struct {
}

func NewParser() Parser {
	return &ApteParser{}
}

func (parser *ApteParser) ParseFullDictionary(filePath string) (
	[]*DictionaryEntry,
	error,
) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("error opening dictionary XML %s", err.Error())
	}

	defer file.Close()
	scanner := bufio.NewScanner(file)
	var entries []*DictionaryEntry

	for scanner.Scan() {
		line := scanner.Text()

		if strings.Contains(line, "<H1>") {
			entryBody := regexp.MustCompile(`<body>(.*?)</body>`)
			match := entryBody.FindStringSubmatch(line)

			entry, err := parser.ParseEntry(match[0])
			if err != nil {
				return nil, err
			}

			entryKey := regexp.MustCompile(`<key1>(.*?)</key1>`)
			match = entryKey.FindStringSubmatch(line)

			if len(match) > 1 {
				entry.Word = match[1]
			}

			entries = append(entries, entry)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return entries, nil
}

func (parser *ApteParser) ParseEntry(content string) (
	*DictionaryEntry,
	error,
) {
	reader := strings.NewReader(content)
	decoder := xml.NewDecoder(reader)

	token, err := decoder.Token()
	if err != nil {
		return nil, fmt.Errorf("error parsing token : %s", err.Error())
	}

	stack := NewStack()
	var entryTokens DictionaryEntryTokens

	for token != nil {
		switch tok := token.(type) {

		case xml.StartElement:
			for !stack.IsEmpty() {
				tk := stack.Pop()

				if tk.Typ == CharData {
					entryTokens = append(entryTokens, tk)
				}
			}

			start := &DictionaryEntryToken{
				Typ:     StartElement,
				Token:   token,
				Content: tok.Name.Local,
			}

			entryTokens = append(entryTokens, start)

			stack.Push(start)

		case xml.CharData:
			stack.Push(&DictionaryEntryToken{
				Typ:     CharData,
				Token:   token,
				Content: string(tok),
			})

		case xml.EndElement:
			for !stack.IsEmpty() {
				tk := stack.Pop()

				if tk.Typ == StartElement {
					break
				}

				if tk.Typ == CharData {
					entryTokens = append(entryTokens, tk)
				}
			}

			end := &DictionaryEntryToken{
				Typ:     EndElement,
				Token:   token,
				Content: tok.Name.Local,
			}

			entryTokens = append(entryTokens, end)
		}

		token, _ = decoder.Token()
	}

	for !stack.IsEmpty() {
		tk := stack.Pop()

		if tk.Typ == CharData {
			entryTokens = append(entryTokens, tk)
		}
	}

	partOfSpeech := entryTokens.GetPartOfSpeech()
	meanings := entryTokens.GetMeanings()

	return &DictionaryEntry{
		Type:     partOfSpeech,
		Meanings: meanings,
	}, nil
}
