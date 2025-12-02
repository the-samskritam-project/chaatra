import { findWordPosition, extractSourceWord } from './textAlignment';

describe('findWordPosition function tests', () => {
  test('finds exact match in simple text', () => {
    const result = findWordPosition('उक्तः', 'एवमुक्तस्तु');
    expect(result).not.toBeNull();
    expect(result.startIndex).toBe(3); // "उक्त" starts at position 3
    expect(result.endIndex).toBeGreaterThan(result.startIndex);
  });

  test('finds match with conjunct characters', () => {
    const result = findWordPosition('अर्कवर्णम्', 'तेनार्कवर्णंसहसाकिरीटं');
    expect(result).not.toBeNull();
    expect(result.startIndex).toBeGreaterThanOrEqual(0);
  });

  test('finds match with half vowels and visarga', () => {
    const result = findWordPosition('ःखचरैरनेकैर्जगामवेगाद्', 'ःखचरैरनेकैर्जगामवेगाद्');
    expect(result).not.toBeNull();
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBeGreaterThan(0);
  });

  test('handles words with different endings (ं vs म्)', () => {
    // "अर्कवर्णं" in text vs "अर्कवर्णम्" in translation
    const result = findWordPosition('अर्कवर्णम्', 'तेनार्कवर्णंसहसा');
    expect(result).not.toBeNull();
    // Should match "अर्कवर्णं" (at least first length-2 chars)
    expect(result.startIndex).toBeGreaterThanOrEqual(0);
  });

  test('returns null when word not found', () => {
    const result = findWordPosition('नास्ति', 'एवमुक्तस्तु');
    expect(result).toBeNull();
  });

  test('handles empty strings', () => {
    expect(findWordPosition('', 'एवमुक्तस्तु')).toBeNull();
    expect(findWordPosition('उक्तः', '')).toBeNull();
    expect(findWordPosition('', '')).toBeNull();
  });

  test('finds word at beginning of text', () => {
    const result = findWordPosition('एव', 'एवमुक्तस्तु');
    expect(result).not.toBeNull();
    expect(result.startIndex).toBe(0);
  });

  test('finds word at end of text', () => {
    const result = findWordPosition('स्तु', 'एवमुक्तस्तु');
    expect(result).not.toBeNull();
    expect(result.endIndex).toBeLessThanOrEqual(Array.from('एवमुक्तस्तु').length);
  });

  test('handles words with conjuncts (क्ष, ज्ञ, etc.)', () => {
    const text = 'रक्षोधिपतेर्महात्मा';
    const word = 'रक्ष';
    const result = findWordPosition(word, text);
    expect(result).not.toBeNull();
    expect(result.startIndex).toBe(0);
  });

  test('finds उक्तः in एवमुक्तस्तु (specific case)', () => {
    const result = findWordPosition('उक्तः', 'एवमुक्तस्तु');
    expect(result).not.toBeNull();
    // "उक्त" should be found starting at character position 3
    const targetChars = Array.from('एवमुक्तस्तु');
    const foundChars = targetChars.slice(result.startIndex, result.endIndex);
    expect(foundChars.join('')).toContain('उक्त');
  });
});

describe('extractSourceWord function tests', () => {
  test('extracts Devanagari word from translation token', () => {
    const token = 'उक्तः not recognised';
    const result = extractSourceWord(token);
    expect(result).toBe('उक्तः');
  });

  test('extracts word with English translation', () => {
    const token = 'अर्कवर्णम् a disrupter';
    const result = extractSourceWord(token);
    expect(result).toBe('अर्कवर्णम्');
  });

  test('handles multiple words before translation', () => {
    const token = 'तप: स्वाध्यायनिरतम् highly delighted';
    const result = extractSourceWord(token);
    expect(result).toContain('तप');
  });
});

