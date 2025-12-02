/**
 * Utility functions for aligning source text with translation tokens
 * Generic and reusable across different text alignment use cases
 */

/**
 * Calculate similarity between two strings using character-based comparison
 * Returns a value between 0 and 1, where 1 is identical
 * Uses a combination of longest common subsequence and character overlap
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score between 0 and 1
 */
export function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const s1 = str1.trim();
  const s2 = str2.trim();

  if (s1.length === 0 && s2.length === 0) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check for substring matches (handles cases like "आप्तयज्ञहरं" vs "आप्तयज्ञहरम्")
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = s1.length < s2.length ? s1 : s2;
    const longer = s1.length >= s2.length ? s1 : s2;
    return shorter.length / longer.length;
  }

  // Calculate longest common subsequence (LCS) length
  const lcsLength = longestCommonSubsequence(s1, s2);
  
  // Calculate character overlap (how many characters match)
  const charOverlap = calculateCharacterOverlap(s1, s2);
  
  // Combine both metrics with weights
  const lcsScore = lcsLength / Math.max(s1.length, s2.length);
  const overlapScore = charOverlap / Math.max(s1.length, s2.length);
  
  // Weighted average (LCS is more important for order, overlap for content)
  return (lcsScore * 0.7 + overlapScore * 0.3);
}

/**
 * Calculate the length of the longest common subsequence
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Length of LCS
 */
function longestCommonSubsequence(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate character overlap between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Number of matching characters
 */
function calculateCharacterOverlap(str1, str2) {
  const chars1 = [...str1];
  const chars2 = [...str2];
  let matches = 0;
  const used2 = new Set();

  for (const char1 of chars1) {
    for (let i = 0; i < chars2.length; i++) {
      if (!used2.has(i) && char1 === chars2[i]) {
        matches++;
        used2.add(i);
        break;
      }
    }
  }

  return matches;
}

/**
 * Calculate Levenshtein edit distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance (number of edits needed)
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a matrix
  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

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
 * Find the position of a source word in target text using edit distance
 * @param {string} sourceWord - The word to find
 * @param {string} targetText - The text to search in
 * @param {number} maxEditDistance - Maximum allowed edit distance (default: 3)
 * @returns {Object|null} Object with {startIndex, endIndex, editDistance} or null if not found
 */
export function findWordPosition(sourceWord, targetText, maxEditDistance = 3) {
  if (!sourceWord || !targetText) return null;

  const sourceWordClean = sourceWord.trim();
  const targetTextClean = targetText.trim();

  if (sourceWordClean.length === 0) return null;

  // First try exact match
  const exactIndex = targetTextClean.indexOf(sourceWordClean);
  if (exactIndex !== -1) {
    return {
      startIndex: exactIndex,
      endIndex: exactIndex + sourceWordClean.length,
      editDistance: 0,
    };
  }

  // Use sliding window with edit distance
  let bestMatch = null;
  let bestEditDistance = Infinity;
  const sourceLength = sourceWordClean.length;

  // Try window sizes around the source word length (±2 characters)
  const windowSizes = [
    sourceLength,
    sourceLength - 1,
    sourceLength + 1,
    sourceLength - 2,
    sourceLength + 2,
  ].filter(len => len > 0 && len <= targetTextClean.length);

  for (const windowSize of windowSizes) {
    for (let i = 0; i <= targetTextClean.length - windowSize; i++) {
      const candidate = targetTextClean.substring(i, i + windowSize);
      const editDist = levenshteinDistance(sourceWordClean, candidate);

      // Accept if edit distance is within threshold and better than previous best
      if (editDist <= maxEditDistance && editDist < bestEditDistance) {
        bestEditDistance = editDist;
        bestMatch = {
          startIndex: i,
          endIndex: i + windowSize,
          editDistance: editDist,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Align source text with translation tokens
 * @param {string} sourceText - The original text (e.g., Sanskrit shloka)
 * @param {string[]} translationTokens - Array of translation tokens
 * @param {Object} options - Configuration options
 * @param {number} options.minSimilarity - Minimum similarity threshold (default: 0.9)
 * @param {string} options.tokenSeparator - Separator for tokens (default: ',')
 * @param {Function} options.extractSourceWordFn - Custom function to extract source word (optional)
 * @returns {Array} Array of aligned parts: {text, startIndex, endIndex, translationIndex}
 */
export function alignTextWithTranslations(sourceText, translationTokens, options = {}) {
  if (!sourceText || !translationTokens || translationTokens.length === 0) {
    return [];
  }

  const {
    maxEditDistance = 3,
    extractSourceWordFn = extractSourceWord,
  } = options;

  const alignedParts = [];
  let currentIndex = 0;
  const sourceTextClean = sourceText.trim();

  // Track used positions to avoid overlaps
  const usedRanges = [];

  for (let i = 0; i < translationTokens.length; i++) {
    const token = translationTokens[i];
    const sourceWord = extractSourceWordFn(token);

    if (!sourceWord) {
      continue;
    }

    // Find position starting from currentIndex to maintain order
    const searchText = sourceTextClean.substring(currentIndex);
    const match = findWordPosition(sourceWord, searchText, maxEditDistance);

    if (match) {
      // Adjust indices to account for currentIndex offset
      const actualStart = currentIndex + match.startIndex;
      const actualEnd = currentIndex + match.endIndex;

      // Check if this range overlaps with any used range
      const overlaps = usedRanges.some(
        (range) =>
          (actualStart < range.end && actualEnd > range.start) ||
          (range.start < actualEnd && range.end > actualStart)
      );

      if (!overlaps) {
        // Add text before this match if any
        if (actualStart > currentIndex) {
          const beforeText = sourceTextClean.substring(currentIndex, actualStart);
          if (beforeText.trim()) {
            alignedParts.push({
              text: beforeText,
              startIndex: currentIndex,
              endIndex: actualStart,
              translationIndex: null,
            });
          }
        }

        // Add the matched part
        const matchedText = sourceTextClean.substring(actualStart, actualEnd);
        alignedParts.push({
          text: matchedText,
          startIndex: actualStart,
          endIndex: actualEnd,
          translationIndex: i,
        });

        usedRanges.push({ start: actualStart, end: actualEnd });
        currentIndex = actualEnd;
      }
    }
  }

  // Add any remaining text after the last match
  if (currentIndex < sourceTextClean.length) {
    const remainingText = sourceTextClean.substring(currentIndex);
    if (remainingText.trim()) {
      alignedParts.push({
        text: remainingText,
        startIndex: currentIndex,
        endIndex: sourceTextClean.length,
        translationIndex: null,
      });
    }
  }

  // If no matches were found, return the entire text as one part
  if (alignedParts.length === 0) {
    alignedParts.push({
      text: sourceTextClean,
      startIndex: 0,
      endIndex: sourceTextClean.length,
      translationIndex: null,
    });
  }

  return alignedParts;
}

