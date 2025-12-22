package http

import (
	"chaatra/core/parser"
	"chaatra/core/trans"
)

// Dictionary and Trie are shared across multiple handlers
var Dictionary map[string]*parser.DictionaryEntry
var Trie *trans.Trie
