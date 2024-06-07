package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/elastic/go-elasticsearch/v7"
	"golang.org/x/net/html"
)

type dhatu struct {
	Devanagari     string `json:"devanagari"`
	EnglishMeaning string `json:"englishMeaning"`
}

func main() {
	filePath := "dhatus.html"
	divClass := "mw-parser-output"

	doc, err := getHTMLContentFromFile(filePath)
	if err != nil {
		fmt.Println("Error reading HTML content from file:", err)
		return
	}

	listItems := extractListItems(doc, divClass)
	var dhatus []dhatu
	for _, item := range listItems {
		line := strings.Split(item, " ")
		if len(line) > 2 {
			root := strings.Split(strings.Join(strings.Split(strings.Join(line[3:], " "), " "), " "), " , ")

			if len(root) == 2 {
				dhatus = append(dhatus, dhatu{
					Devanagari:     root[0],
					EnglishMeaning: root[1],
				})
			}
		}
	}

	writeToEs(dhatus)
}

// Function to get the HTML content from a local file
func getHTMLContentFromFile(filePath string) (*html.Node, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	doc, err := html.Parse(file)
	if err != nil {
		return nil, err
	}

	return doc, nil
}

// Function to extract content from <li> tags within <ul> tags inside a specific <div>
func extractListItems(node *html.Node, divClass string) []string {
	var listItems []string

	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "div" {
			for _, a := range n.Attr {
				if a.Key == "class" && a.Val == divClass {
					// Found the target div, now look for <ul> tags within it
					findListItems(n, &listItems)
					break
				}
			}
		}
		// Traverse the child nodes
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			traverse(c)
		}
	}

	traverse(node)
	return listItems
}

// Function to find <li> tags within <ul> tags inside a node
func findListItems(node *html.Node, listItems *[]string) {
	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "ul" {
			// Found a <ul> tag, now look for <li> tags within it
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				if c.Type == html.ElementNode && c.Data == "li" {
					// Found an <li> tag, extract its content
					content := getTextContent(c)
					*listItems = append(*listItems, content)
				}
			}
		}
		// Traverse the child nodes
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			traverse(c)
		}
	}
	traverse(node)
}

// Function to get the text content of a node
func getTextContent(n *html.Node) string {
	var content string
	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if n.Type == html.TextNode {
			content += n.Data
		}
		// Traverse the child nodes
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			traverse(c)
		}
	}
	traverse(n)
	return strings.TrimSpace(content)
}

func writeToEs(dhatus []dhatu) {
	es, err := elasticsearch.NewClient(elasticsearch.Config{
		Addresses: []string{"http://localhost:9200"},
	})
	if err != nil {
		log.Fatalf("Error creating the client: %s", err)
	}

	ctx := context.Background()
	indexName := "dhatus"

	// Check if the index exists
	res, err := es.Indices.Exists([]string{indexName})
	if err != nil {
		log.Fatalf("Error checking if index exists: %s", err)
	}
	if res.StatusCode == 404 {
		// Create the index if it does not exist
		res, err := es.Indices.Create(indexName)
		if err != nil {
			log.Fatalf("Error creating index: %s", err)
		}
		if res.IsError() {
			log.Fatalf("Error response while creating index: %s", res.String())
		}
	}

	// Index the dhatusArray
	for _, dhatu := range dhatus {
		data, err := json.Marshal(dhatu)
		if err != nil {
			log.Fatalf("Error marshaling dhatu: %s", err)
		}

		// Index the document
		res, err := es.Index(
			indexName,
			bytes.NewReader(data),
			es.Index.WithContext(ctx),
		)
		if err != nil {
			log.Fatalf("Error indexing dhatu: %s", err)
		}
		if res.IsError() {
			log.Fatalf("Error response while indexing dhatu: %s", res.String())
		}
	}

	fmt.Println("Successfully indexed dhatus")
}
