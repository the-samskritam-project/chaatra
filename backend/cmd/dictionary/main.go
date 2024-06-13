package main

import (
	"bufio"
	"chaatra/core/trans"
	"chaatra/service"
	"fmt"
	"log"
	"os"
)

func main() {
	dictionary, err := service.ParseApteDictionary(`dictionary.xml`)
	if err != nil {
		log.Println(`error parsing the dicrionary : `, err.Error())

		os.Exit(1)
	}

	t := service.BuildTrie(dictionary)

	demarcator := "-"
	for i := 0; i < 8; i++ {
		demarcator += demarcator
	}

	for {
		fmt.Println(demarcator)

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

				fmt.Println(entry.Type)

				for _, meaning := range entry.Meanings {
					fmt.Println(meaning)
				}

				fmt.Println(demarcator)
			}
		}

		fmt.Println(demarcator)
	}
}
