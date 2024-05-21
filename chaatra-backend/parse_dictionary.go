package main

import (
	"bufio"
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

// Function to parse each H1 entry
func parse(t *trie) {
	// Open the XML file
	file, err := os.Open("./dictionary.xml")
	if err != nil {
		fmt.Println("Error opening file:", err)
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)

	var dictionary = make(dictionary)

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

			// Assuming getTokens and stringifyTokens are implemented elsewhere
			tokens := getTokens(h1.Head.Key1)
			t.add(tokens)

			devanagariWord := stringifyTokens(tokens)

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
	} else {
		d = &dictionary
	}

	indexEntries(dictionary)

	log.Println("Processed records :", count)
}
