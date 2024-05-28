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

	mat := make([][]int, l1+1)

	for i := 0; i <= l1; i++ {
		mat[i] = make([]int, l2+1)
	}

	for i := 0; i <= l1; i++ {
		mat[i][0] = i
	}

	for j := 0; j <= l2; j++ {
		mat[0][j] = j
	}

	for i := 1; i < l1+1; i++ {
		for j := 1; j < l2+1; j++ {
			topIndex := i - 1
			leftIndex := j - 1

			top := mat[topIndex][j]
			left := mat[i][leftIndex]
			topLeft := mat[topIndex][leftIndex]

			if s[i-1] == t[j-1] {
				mat[i][j] = getMin(top, left, topLeft)
			} else {
				mat[i][j] = getMin(top, left, topLeft) + 1
			}
		}
	}

	return mat[l1-1][l2-1]
}

func getMin(x, y, z int) int {
	m := min(min(x, y), z)

	if m == -1 {
		return 0
	}

	return m
}

func min(x, y int) int {
	if x < y {
		return x
	}

	return y
}
