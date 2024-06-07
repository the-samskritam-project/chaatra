package main

import (
	"fmt"
	"os"
	"strings"

	"golang.org/x/net/html"
)

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

func main() {
	filePath := "dhatus.html"
	divClass := "mw-parser-output"

	doc, err := getHTMLContentFromFile(filePath)
	if err != nil {
		fmt.Println("Error reading HTML content from file:", err)
		return
	}

	listItems := extractListItems(doc, divClass)
	for _, item := range listItems {
		line := strings.Split(item, " ")
		if len(line) > 2 {
			root := strings.Split(strings.Join(strings.Split(strings.Join(line[3:], " "), " "), " "), " , ")

			if len(root) == 2 {
				fmt.Printf("%s : %s", root[0], root[1])
				fmt.Println()
			}
		}
	}
}
