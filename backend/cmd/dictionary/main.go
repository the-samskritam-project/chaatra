package main

import (
	"bufio"
	"chaatra/core/trans"
	"chaatra/service"
	"fmt"
	"log"
	"os"
	"strings"
)

func main() {
	dictionary, err := service.ParseApteDictionary(`dictionary.xml`)
	if err != nil {
		log.Println(`error parsing the dicrionary : `, err.Error())

		os.Exit(1)
	}

	t := service.BuildTrie(dictionary)

	for {
		fmt.Print("Enter your SLP1 string : ")
		scanner := bufio.NewScanner(os.Stdin)
		scanner.Scan()
		input := scanner.Text()

		// Exit the loop if the input is empty
		if input == "" {
			break
		}

		matches := service.LookupPrefixes(t, input)
		for _, match := range matches {
			entry := dictionary[match.LatinSLP1()]
			if entry != nil {
				fmt.Println(trans.StringifyTokens(trans.GetTokens(entry.Word)))

				fmt.Println(strings.Join(entry.Meanings, ""))

				fmt.Println()
			}
		}
	}
}
