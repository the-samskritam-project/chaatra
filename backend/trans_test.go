package main

import (
	"testing"
)

var testSet = map[string]string{
	"anujAta":   "अनुजात",
	"anuSocana": "अनुशोचन",
	"mAhAvratI": "माहाव्रती",
}

func TestTrans(t *testing.T) {
	for inp, exp := range testSet {
		act := trans(inp)

		if act != exp {
			t.Errorf("Expected : %s, Actual : %s", exp, act)
		}
	}
}
