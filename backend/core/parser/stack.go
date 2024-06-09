package parser

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
