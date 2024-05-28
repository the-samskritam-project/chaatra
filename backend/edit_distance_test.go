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
