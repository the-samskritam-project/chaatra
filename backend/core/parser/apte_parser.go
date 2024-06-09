package parser

import (
	"bufio"
	"encoding/xml"
	"fmt"
	"os"
	"strings"
)

type DictionaryEntry struct {
	Type     string
	Meanings []string
}

type MetaInfo struct {
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

		reader := strings.NewReader(line)
		decoder := xml.NewDecoder(reader)

		for {
			_, err := decoder.Token()
			if err != nil {
				return nil, fmt.Errorf("error parsing token : %s", err.Error())
			}

			entryToken, err := parser.ParseEntry("token")
			if err != nil {
				return nil, err
			}

			entries = append(entries, entryToken)
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
