package trans

import (
	"testing"
)

func TestTrans(t *testing.T) {
	var testSet = map[string]string{
		"anujAta":   "अनुजात",
		"anuSocana": "अनुशोचन",
		"mAhAvratI": "माहाव्रती",
	}

	for inp, exp := range testSet {
		act := Trans(inp)

		if act != exp {
			t.Errorf("Expected : %s, Actual : %s", exp, act)
		}
	}
}
