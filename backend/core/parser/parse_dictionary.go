package parser

import (
	"bufio"
	"chaatra/core/trans"
	"encoding/xml"
	"fmt"
	"log"
	"os"
	"strings"
)

// Define your structs based on the XML structure
type H1 struct {
	XMLName xml.Name `xml:"H1"`
	Head    Header   `xml:"h"`
	Body    Body     `xml:"body"`
	Tail    Tail     `xml:"tail"`
}

type Header struct {
	Key1 string `xml:"key1"`
	Key2 string `xml:"key2"`
	Hom  string `xml:"hom,omitempty"`
}

type Tail struct {
	L  string `xml:"L"`
	Pc string `xml:"pc"`
}

// Define a Body struct if needed for deeper parsing
type Body struct {
	Result string
}

var D Dictionary

// Function to Parse each H1 entry
func Parse(t *trans.Trie) Dictionary {
	// Open the XML file
	file, err := os.Open("./dictionary.xml")
	if err != nil {
		fmt.Println("Error opening file:", err)
		return nil
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)

	var dictionary = make(Dictionary)

	count := 0

	for scanner.Scan() {
		line := scanner.Text()

		// Check if the line contains the <H1> tag
		if strings.Contains(line, "<H1>") {
			var h1 H1
			err := xml.Unmarshal([]byte(line), &h1)
			if err != nil {
				fmt.Println("Error unmarshalling XML:", err)
				continue
			}

			tokens := trans.GetTokens(h1.Head.Key1)
			t.Add(tokens)

			devanagariWord := trans.StringifyTokens(tokens)

			if _, ok := dictionary[devanagariWord]; !ok {
				count++
				dictionary[devanagariWord] = &Entry{
					DevanagariWord:     devanagariWord,
					TransliteratedWord: h1.Head.Key1,
					EnglishMeaning:     h1.Body.Result,
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Println("Error reading file:", err)

		return nil
	}

	log.Println("Processed records :", count)

	return dictionary
}
