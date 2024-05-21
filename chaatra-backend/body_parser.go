package main

import (
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

type BodyToken struct {
	IsTag   bool
	TagName string
	Content string
}

type stack struct {
	tokens []*BodyToken
}

func (s *stack) isEmpty() bool {
	return len(s.tokens) == 0
}

func (s *stack) push(t *BodyToken) {
	s.tokens = append(s.tokens, t)
}

func (s *stack) pop() *BodyToken {
	if top := s.peek(); top == nil {
		return nil
	} else {
		l := len(s.tokens)

		s.tokens = s.tokens[:l-1]
		return top
	}
}

func (s *stack) peek() *BodyToken {
	if s.isEmpty() {
		return nil
	}

	l := len(s.tokens)
	top := s.tokens[l-1]

	return top
}

func (b *Body) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	stack := new(stack)
	var result string

	for {
		token, err := d.Token()

		if err == io.EOF {
			break
		} else if err != nil {
			return err
		}

		switch t := token.(type) {
		case xml.StartElement:
			for !stack.isEmpty() && !stack.peek().IsTag {
				contentToken := stack.pop()

				result = fmt.Sprintf("%s%s", result, contentToken.Content)
			}

			if !stack.isEmpty() {
				stack.pop()
			}

			token := &BodyToken{IsTag: true, TagName: t.Name.Local}
			stack.push(token)

		case xml.CharData:
			token := &BodyToken{IsTag: false, Content: string(t)}
			stack.push(token)

		case xml.EndElement:
			var contentToken *BodyToken
			for !stack.isEmpty() && !stack.peek().IsTag {
				contentToken = stack.pop()

				if t.Name.Local == "s" {
					splitResuts := strings.Split(contentToken.Content, " ")

					var devanagiriStrings []string
					for _, res := range splitResuts {
						devanagiriStrings = append(devanagiriStrings, (stringifyTokens(getTokens(res))))
					}

					result = fmt.Sprintf("%s%s", result, strings.Join(devanagiriStrings, " "))
				} else {
					result = fmt.Sprintf("%s%s", result, contentToken.Content)
				}
			}

			if !stack.isEmpty() {
				stack.pop()
			}
		}
	}

	b.Result = result

	return nil
}
