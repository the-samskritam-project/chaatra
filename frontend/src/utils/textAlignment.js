/**
 * Utility functions for aligning source text with translation tokens
 * Generic and reusable across different text alignment use cases
 */

/**
 * Extract the source language word from a translation token
 * Handles formats like "आप्तयज्ञहरम् a disrupter..." or "word1 word2 translation"
 * @param {string} token - Translation token containing source word and translation
 * @returns {string} Extracted source word
 */
export function extractSourceWord(token) {
  if (!token) return '';

  // Remove leading/trailing whitespace
  const trimmed = token.trim();

  // Try to find where the English translation starts
  // Common patterns:
  // 1. Sanskrit word followed by English (e.g., "आप्तयज्ञहरम् a disrupter")
  // 2. Multiple words followed by English (e.g., "word1 word2 translation")
  
  // Look for the first occurrence of a pattern that suggests English text
  // This is a heuristic: if we see a character that's likely English (a-z, A-Z)
  // after some non-English characters, that's likely the break point
  
  // First, try to find a space followed by a lowercase/uppercase English letter
  // This handles cases like "आप्तयज्ञहरम् a disrupter"
  const englishStartPattern = /\s+[a-zA-Z]/;
  const match = trimmed.search(englishStartPattern);
  
  if (match > 0) {
    // Extract everything before the English text
    const sourceWord = trimmed.substring(0, match).trim();
    // Remove any trailing punctuation that might be part of the source word
    // but keep Devanagari punctuation marks
    return sourceWord;
  }

  // If no clear English pattern, try to find where Devanagari/Sanskrit ends
  // Split by spaces and take the first few words that don't start with English letters
  const parts = trimmed.split(/\s+/);
  const sourceWords = [];
  
  for (const part of parts) {
    // If the part starts with an English letter, we've likely hit the translation
    if (/^[a-zA-Z]/.test(part)) {
      break;
    }
    // Also check if the part contains mostly English characters
    // (more than 50% English letters suggests it's part of the translation)
    const englishCharCount = (part.match(/[a-zA-Z]/g) || []).length;
    if (englishCharCount > part.length * 0.5 && part.length > 2) {
      break;
    }
    sourceWords.push(part);
  }

  const result = sourceWords.join(' ').trim();
  return result || trimmed;
}

/**
 * Find the position of a source word in target text using substring matching
 * Matches at least until the second-last character (word.length - 2)
 * Uses character arrays to properly handle Devanagari conjuncts and half vowels
 * @param {string} sourceWord - The word to find
 * @param {string} targetText - The text to search in
 * @returns {Object|null} Object with {startIndex, endIndex} or null if not found
 */
export function findWordPosition(sourceWord, targetText) {
  if (!sourceWord || !targetText) return null;

  const sourceWordClean = sourceWord.trim();
  const targetTextClean = targetText.trim();

  if (sourceWordClean.length === 0) return null;

  // Convert strings to character arrays for proper Unicode handling
  const sourceChars = Array.from(sourceWordClean);
  const targetChars = Array.from(targetTextClean);

  if (sourceChars.length === 0) return null;

  // First try exact match using character arrays
  const exactMatch = findExactMatch(sourceChars, targetChars);
  if (exactMatch) {
    return exactMatch;
  }

  // Match at least until second-last character
  const minMatchLength = Math.max(1, sourceChars.length - 2);
  const prefixToMatch = sourceChars.slice(0, minMatchLength);

  // Find the prefix position in the target character array
  const prefixIndex = findSubarrayIndex(prefixToMatch, targetChars);
  if (prefixIndex === -1) {
    return null;
  }

  // Found the prefix, now try different window sizes starting from that position
  const sourceLength = sourceChars.length;
  const windowSizes = [
    sourceLength + 2,
    sourceLength + 1,
    sourceLength,
    sourceLength - 1,
    sourceLength - 2,
  ].filter(len => len > 0 && len <= targetChars.length);

  let bestMatch = null;
  let bestMatchLength = 0;

  for (const windowSize of windowSizes) {
    if (prefixIndex + windowSize <= targetChars.length) {
      const candidate = targetChars.slice(prefixIndex, prefixIndex + windowSize);
      
      // Check if candidate starts with the required prefix
      if (arraysStartWith(candidate, prefixToMatch)) {
        // Prefer longer matches
        if (windowSize > bestMatchLength) {
          bestMatch = {
            startIndex: prefixIndex,
            endIndex: prefixIndex + windowSize,
          };
          bestMatchLength = windowSize;
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Find exact match of sourceChars in targetChars
 * @param {Array} sourceChars - Source word as character array
 * @param {Array} targetChars - Target text as character array
 * @returns {Object|null} Object with {startIndex, endIndex} or null
 */
function findExactMatch(sourceChars, targetChars) {
  for (let i = 0; i <= targetChars.length - sourceChars.length; i++) {
    let match = true;
    for (let j = 0; j < sourceChars.length; j++) {
      if (targetChars[i + j] !== sourceChars[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return {
        startIndex: i,
        endIndex: i + sourceChars.length,
      };
    }
  }
  return null;
}

/**
 * Find the index of a subarray within a larger array
 * @param {Array} subarray - The subarray to find
 * @param {Array} array - The array to search in
 * @returns {number} Index of subarray or -1 if not found
 */
function findSubarrayIndex(subarray, array) {
  if (subarray.length === 0) return 0;
  if (subarray.length > array.length) return -1;

  for (let i = 0; i <= array.length - subarray.length; i++) {
    let match = true;
    for (let j = 0; j < subarray.length; j++) {
      if (array[i + j] !== subarray[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i;
    }
  }
  return -1;
}

/**
 * Check if an array starts with a given prefix array
 * @param {Array} array - The array to check
 * @param {Array} prefix - The prefix array
 * @returns {boolean} True if array starts with prefix
 */
function arraysStartWith(array, prefix) {
  if (prefix.length > array.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (array[i] !== prefix[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Align source text with translation tokens
 * Creates a map of word -> index, sorts by index, and returns parts in order
 * @param {string} sourceText - The original text (e.g., Sanskrit shloka)
 * @param {string[]} translationTokens - Array of translation tokens
 * @param {Object} options - Configuration options
 * @param {Function} options.extractSourceWordFn - Custom function to extract source word (optional)
 * @returns {Array} Array of aligned parts: {text, startIndex, endIndex, translationIndex}
 */
export function alignTextWithTranslations(sourceText, translationTokens, options = {}) {
  if (!sourceText || !translationTokens || translationTokens.length === 0) {
    return [];
  }

  const {
    extractSourceWordFn = extractSourceWord,
  } = options;

  const sourceTextClean = sourceText.trim();
  
  // Map to store word -> index
  const wordToIndexMap = new Map();
  
  // Find position for each translation token
  for (let i = 0; i < translationTokens.length; i++) {
    const token = translationTokens[i];
    const sourceWord = extractSourceWordFn(token);

    if (!sourceWord) {
      continue;
    }

    // Find position in the entire text
    const match = findWordPosition(sourceWord, sourceTextClean);

    if (match) {
      // Store the match with translation index
      wordToIndexMap.set(i, {
        startIndex: match.startIndex,
        endIndex: match.endIndex,
        translationIndex: i,
        word: sourceWord,
      });
    }
  }

  // Sort all matches by startIndex
  const sortedMatches = Array.from(wordToIndexMap.values())
    .sort((a, b) => a.startIndex - b.startIndex);

  if (sortedMatches.length === 0) {
    // If no matches found, return entire text as one part
    return [{
      text: sourceTextClean,
      startIndex: 0,
      endIndex: sourceTextClean.length,
      translationIndex: null,
    }];
  }

  // Build aligned parts in order - only include words that have translations
  const alignedParts = [];

  for (const match of sortedMatches) {
    // Only add the matched part - use the word from translation, not from shloka
    alignedParts.push({
      text: match.word, // Use the word from translation token
      startIndex: match.startIndex,
      endIndex: match.endIndex,
      translationIndex: match.translationIndex,
    });
  }

  return alignedParts;
}

