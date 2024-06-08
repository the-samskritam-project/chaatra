package core

import (
	"bufio"
	"encoding/xml"
	"fmt"
	"log"
	"os"
	"strings"
)

type DictionaryEntry struct {
	Type string
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

type TokenType string

const StartElement TokenType = "Start"
const EndElement TokenType = "End"
const CharData TokenType = "CharData"

type DictionaryEntryToken struct {
	Token   xml.Token
	Typ     TokenType
	Content string
}

type TokenStack struct {
	Tokens []*DictionaryEntryToken
}

func NewStack() *TokenStack {
	return &TokenStack{
		Tokens: []*DictionaryEntryToken{},
	}
}

func (s *TokenStack) IsEmpty() bool {
	return len(s.Tokens) == 0
}

func (s *TokenStack) Push(t *DictionaryEntryToken) {
	s.Tokens = append(s.Tokens, t)
}

func (s *TokenStack) Pop() *DictionaryEntryToken {
	l := len(s.Tokens)
	if l == 0 {
		return nil
	}

	toPop := s.Tokens[l-1]

	s.Tokens = s.Tokens[:l-1]

	return toPop
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
	for token != nil {
		switch tok := token.(type) {

		case xml.StartElement:
			stack.Push(&DictionaryEntryToken{
				Typ:   StartElement,
				Token: token,
			})

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
					log.Println(tk.Content)
				}
			}

			for !stack.IsEmpty() {
				tk := stack.Pop()

				if tk.Typ == CharData {
					log.Println(tk.Content)
				}
			}

		}

		token, _ = decoder.Token()
	}

	return nil, nil
}
