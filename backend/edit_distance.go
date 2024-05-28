package main

func SortByCloseness(str string, candidates []string) []string {
	return []string{}
}

func GetEditDistance(s string, t string) int {
	if s == "" || t == "" {
		res := len(s) - len(t)

		if res >= 0 {
			return res
		}

		return res * -1
	}

	l1 := len(s)
	l2 := len(t)

	mat := make([][]int, l1)

	for i := 0; i < l1; i++ {
		for j := 0; j <= l2; j++ {
			mat[i] = make([]int, l2)
		}
	}

	for i := 0; i < l1; i++ {
		for j := 0; j < l2; j++ {
			topIndex := i - 1
			leftIndex := j - 1

			top, left, topLeft := -1, -1, -1

			if topIndex >= 0 {
				top = mat[topIndex][j]
			}

			if leftIndex >= 0 {
				left = mat[i][leftIndex]
			}

			if topIndex >= 0 && leftIndex >= 0 {
				topLeft = mat[topIndex][leftIndex]
			}

			leastUptoNow := getMin(top, left, topLeft)
			if leastUptoNow == -1 {
				leastUptoNow = 0
			}

			if s[i] == t[j] {
				mat[i][j] = leastUptoNow
			} else {
				mat[i][j] = leastUptoNow + 1
			}
		}
	}

	return mat[l1-1][l2-1]
}

func getMin(x, y, z int) int {
	return min(min(x, y), z)
}

func min(x, y int) int {
	if x < y && x != -1 {
		return x
	}

	return y
}
