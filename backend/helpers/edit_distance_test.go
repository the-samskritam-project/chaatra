package helpers

import "testing"

func TestGetEditDistance(t *testing.T) {
	testCases := []struct {
		s   string
		t   string
		exp int
	}{
		{
			s:   "sitting",
			t:   "kitten",
			exp: 3,
		},
		{
			s:   "samskritam",
			t:   "sanskrit",
			exp: 3,
		},
		{
			s:   "samskritam",
			t:   "sam",
			exp: 7,
		},
		{
			s:   "samskritam",
			t:   "",
			exp: 10,
		},
		{
			s:   "samskritam",
			t:   "a",
			exp: 9,
		},
		{
			s:   "samskritam",
			t:   "xyz",
			exp: 10,
		},
		{
			s:   "samskritam",
			t:   "kta",
			exp: 7,
		},
		{
			s:   "samskritam",
			t:   "mm",
			exp: 8,
		},
	}

	for i, testCase := range testCases {
		actual := GetEditDistance(testCase.s, testCase.t)

		if testCase.exp != actual {
			t.Errorf(
				`Expected : %d, Actual : %d for "%s" and "%s"`,
				testCase.exp,
				actual,
				testCase.s,
				testCase.t)
		} else {
			t.Logf(
				`Testcase %d passed. Got %d for "%s" and "%s"`,
				i,
				actual,
				testCase.s,
				testCase.t,
			)
		}
	}
}

func TestSortByCloseness(t *testing.T) {
	testCases := []struct {
		inputStr   string
		candidates []string
		expected   []string
	}{
		{
			inputStr:   "test",
			candidates: []string{"testing", "test", "taste", "best", "rest", "fest", "pest"},
			expected:   []string{"test", "best", "rest", "fest", "pest"},
		},
		{
			inputStr:   "hello",
			candidates: []string{"hell", "hallo", "he", "hel", "h", "ello", "yellow"},
			expected:   []string{"hell", "hallo", "hel", "he", "h"},
		},
		{
			inputStr:   "example",
			candidates: []string{"sample", "examp", "exams", "example", "samples", "sam"},
			expected:   []string{"example", "examp", "sample", "exams", "samples"},
		},
		{
			inputStr:   "openai",
			candidates: []string{"open", "ai", "pen", "openai", "op", "enai", "opena"},
			expected:   []string{"openai", "opena", "open", "enai", "op"},
		},
	}

	for i, testCase := range testCases {
		actuals := SortByCloseness(testCase.inputStr, testCase.expected)

		for j, actual := range actuals {
			if actual != testCase.expected[j] {
				t.Errorf(
					`For test case %d, expecting %s at index %d, but got %s`,
					i,
					testCase.expected[j],
					j,
					actual,
				)
			}
		}
	}
}
