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

    test('returns a match where the substrings are not together', () => {
        const str = "hello world hello";
        const subStr = "hello";
        const expected = [0, 12];
        expect(find(str, subStr)).toEqual(expected);
    });

    test('empty string', () => {
        const str = "";
        const subStr = "world";
        const expected = [];
        expect(find(str, subStr)).toEqual(expected);
    });

    test('empty sub-string', () => {
        const str = "hello world";
        const subStr = "";
        const expected = [];
        expect(find(str, subStr)).toEqual(expected);
    });

    test('devanagari substring', () => {
        const str = "Comp. — मति a. 1 possessed of presence of mind";
        const subStr = "मति";
        const expected = [8];
        expect(find(str, subStr)).toEqual(expected);
    });

    test('devanagari string and substring', () => {
        const str = "विधिरहो बलवानिति मे मतिः";
        const subStr = "मतिः";
        const expected = [20];
        expect(find(str, subStr)).toEqual(expected);
    });
});