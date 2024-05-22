import { find } from './subStringMatcher';

describe('find function tests', () => {
    test('finds all occurrences of a substring', () => {
        const str = "hello hello world";
        const subStr = "hello";
        const expected = [0, 6];
        expect(find(str, subStr)).toEqual(expected);
    });

    test('returns empty array when there are no matches', () => {
        const str = "hello hello world";
        const subStr = "blah";
        const expected = [];
        expect(find(str, subStr)).toEqual(expected);
    });

    test('returns a single match', () => {
        const str = "hello hello world";
        const subStr = "world";
        const expected = [12];
        expect(find(str, subStr)).toEqual(expected);
    });
});