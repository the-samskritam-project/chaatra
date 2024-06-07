package persistence

import (
	"bytes"
	"chaatra/core"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/elastic/go-elasticsearch/v7"
)

var es *elasticsearch.Client

func InitEs() {
	cfg := elasticsearch.Config{
		Addresses: []string{
			"http://host.docker.internal:9200", // Your Elasticsearch address
		},
	}
	var err error
	es, err = elasticsearch.NewClient(cfg)
	if err != nil {
		log.Fatalf("Error creating the Elasticsearch client: %s", err)
	}
}

func IndexEntries(entries core.Dictionary) {
	var body strings.Builder

	for _, entry := range entries {
		// Update here: remove the _type field from the bulk API meta-data line
		meta := []byte(`{ "index" : { "_index" : "dictionary" } }`) // Removed "_type" parameter
		body.Write(meta)
		body.WriteByte('\n')

		jsonData, err := json.Marshal(entry)
		if err != nil {
			log.Fatalf("Error marshaling to JSON: %s", err)
		}
		body.Write(jsonData)
		body.WriteByte('\n')
	}

	// Perform the bulk request
	res, err := es.Bulk(strings.NewReader(body.String()), es.Bulk.WithIndex("dictionary"))
	if err != nil {
		log.Fatalf("Error performing bulk indexing: %s", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		var e map[string]interface{}
		json.NewDecoder(res.Body).Decode(&e) // Decoding the response to get detailed error message
		log.Printf("Error with bulk request: %v", e)
	} else {
		log.Println("Bulk indexing successful")
	}
}

func SearchDictionaryEntry(searchTerm string) ([]*core.Entry, error) {
	log.Println("Search term is : ", searchTerm)

	// Define the query
	var buf bytes.Buffer
	query := map[string]interface{}{
		"query": map[string]interface{}{
			"multi_match": map[string]interface{}{
				"query":  searchTerm,
				"fields": []string{"devanagariWord", "englishMeaning"},
			},
		},
	}
	if err := json.NewEncoder(&buf).Encode(query); err != nil {
		return nil, err
	}

	// Perform the search request
	res, err := es.Search(
		es.Search.WithContext(context.Background()),
		es.Search.WithIndex("dictionary"),
		es.Search.WithBody(&buf),
		es.Search.WithPretty(),
	)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.IsError() {
		var e map[string]interface{}
		if err := json.NewDecoder(res.Body).Decode(&e); err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("error searching: %s", e)
	}

	var r map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&r); err != nil {
		return nil, err
	}

	hits := r["hits"].(map[string]interface{})["hits"].([]interface{})
	entries := make([]*core.Entry, 0, len(hits))
	for _, hit := range hits {
		source := hit.(map[string]interface{})["_source"]
		entryData, _ := json.Marshal(source)
		var entry core.Entry
		if err := json.Unmarshal(entryData, &entry); err != nil {
			return nil, err
		}
		entries = append(entries, &entry)
	}

	return entries, nil
}

func SearchDhatu(query string) ([]core.Dhatu, error) {
	ctx := context.Background()
	var b strings.Builder
	b.WriteString(fmt.Sprintf(`{
	  "query": {
	    "match": {
	      "englishMeaning": %s
	    }
	  }
	}`, query))

	// Perform the search request
	res, err := es.Search(
		es.Search.WithContext(ctx),
		es.Search.WithIndex("dhatus"),
		es.Search.WithBody(strings.NewReader(b.String())),
		es.Search.WithTrackTotalHits(true),
		es.Search.WithPretty(),
	)
	if err != nil {
		return nil, fmt.Errorf("error getting response: %w", err)
	}
	defer res.Body.Close()

	// Check for errors in the search response
	if res.IsError() {
		var e map[string]interface{}
		if err := json.NewDecoder(res.Body).Decode(&e); err != nil {
			return nil, fmt.Errorf("error parsing the response body: %w", err)
		} else {
			// Return the error information
			return nil, fmt.Errorf("[%s] %s: %s",
				res.Status(),
				e["error"].(map[string]interface{})["type"],
				e["error"].(map[string]interface{})["reason"],
			)
		}
	}

	// Parse the search results
	var r map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&r); err != nil {
		return nil, fmt.Errorf("error parsing the response body: %w", err)
	}

	// Create an array to hold the search results
	var dhatus []core.Dhatu

	// Populate the array with the search results
	for _, hit := range r["hits"].(map[string]interface{})["hits"].([]interface{}) {
		var d core.Dhatu
		source := hit.(map[string]interface{})["_source"]
		sourceBytes, _ := json.Marshal(source)
		if err := json.Unmarshal(sourceBytes, &d); err != nil {
			return nil, fmt.Errorf("error unmarshaling source: %w", err)
		}
		dhatus = append(dhatus, d)
	}

	return dhatus, nil
}
