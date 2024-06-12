package main

import (
	"bufio"
	"chaatra/service"
	"fmt"
	"log"
	"os"
)

func main() {
	results, err := service.ParseApteDictionary(`dictionary.xml`)
	if err != nil {
		log.Println(`error parsing the dicrionary : `, err.Error())

		os.Exit(1)
	}

	t := service.BuildTrie(results)

	for {
		fmt.Print("Enter your SLP1 string : ")
		scanner := bufio.NewScanner(os.Stdin)
		scanner.Scan()
		input := scanner.Text()

		// Exit the loop if the input is empty
		if input == "" {
			break
		}

		matches := service.TransliterateAndLookup(t, input)
		for _, match := range matches {
			fmt.Println(match.LatinSLP1(), match.Devanagari())
		}
	}
}
