package trans

import "testing"

func TestStringify(t *testing.T) {
	testCases := []struct {
		input string
		exp   string
	}{
		{
			input: "cup",
			exp:   "चुप्",
		},
		{
			input: "ak",
			exp:   "अक्",
		},
		{
			input: "laK",
			exp:   "लख्",
		},
	}

	for _, testCase := range testCases {
		tokens := GetTokens(testCase.input)

		if got := StringifyTokens(tokens); got != testCase.exp {
			t.Errorf("Expected : %s, Got %s. Input string : %s", testCase.exp, got, testCase.input)
		}
	}
}
