package main

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
			t:   "sa",
			exp: 8,
		},
		{
			s:   "samskritam",
			t:   "",
			exp: 10,
		},
	}

	for _, testCase := range testCases {
		actual := GetEditDistance(testCase.s, testCase.t)

		if testCase.exp != actual {
			t.Errorf(
				`Expected : %d, Actual : %d for "%s" and "%s"`,
				testCase.exp,
				actual,
				testCase.s,
				testCase.t)
		}
	}
}
