package main

import "sort"

type Distance struct {
	str  string
	dist int
}

type ByDist []Distance

func (a ByDist) Len() int {
	return len(a)
}

func (a ByDist) Swap(i, j int) {
	a[i], a[j] = a[j], a[i]
}

func (a ByDist) Less(i, j int) bool {
	return a[i].dist < a[j].dist
}

func SortByCloseness(str string, candidates []string) []string {
	distances := make([]Distance, len(candidates))

	for i, candidate := range candidates {
		dist := GetEditDistance(candidate, str)

		distances[i] = Distance{
			str:  candidate,
			dist: dist,
		}
	}

	sort.Sort(ByDist(distances))

	var results []string

	for i, r := range distances {
		if i >= 5 {
			break
		}

		results = append(results, r.str)
	}

	return results
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
		mat[i][0] = i
	}

	for j := 0; j <= l2; j++ {
		mat[0][j] = j
	}

	for i := 1; i <= l1; i++ {
		for j := 1; j <= l2; j++ {
			top := mat[i-1][j]
			left := mat[i][j-1]
			topLeft := mat[i-1][j-1]

			if s[i-1] == t[j-1] {
				mat[i][j] = topLeft
			} else {
				mat[i][j] = getMin(top+1, left+1, topLeft+1)
			}
		}
	}

	return mat[l1][l2]
}

func getMin(x, y, z int) int {
	m := min(min(x, y), z)

	return m
}

func min(x, y int) int {
	if x < y {
		return x
	}

	return y
}
