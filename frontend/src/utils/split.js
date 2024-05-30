export function getLastWord(inputString) {
    // Trim the string first to remove leading and trailing spaces
    // and split the string into an array of substrings
    const words = inputString.trim().split(' ').filter(word => word !== '');

    // Access the last word
    const lastWord = words.length > 0 ? words[words.length - 1] : '';

    return lastWord;
}
