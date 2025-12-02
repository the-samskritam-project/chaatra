import React, { useMemo, useState } from 'react';
import { alignTextWithTranslations } from '../utils/textAlignment';
import './AlignedTextView.css';

/**
 * Generic component for displaying source text aligned with translation tokens
 * Supports hover highlighting between corresponding parts
 * 
 * @param {Object} props
 * @param {string} props.sourceText - The original text (e.g., Sanskrit shloka)
 * @param {string} props.translation - The translation string
 * @param {string} props.tokenSeparator - How to split translation into tokens (default: ',')
 * @param {number} props.maxEditDistance - Maximum edit distance for matching (default: 3)
 * @param {string} props.sourceClassName - CSS class for source text container
 * @param {string} props.translationClassName - CSS class for translation container
 * @param {string} props.highlightClassName - CSS class for highlighted elements
 * @param {Function} props.splitIntoLines - Optional function to split source text into lines
 */
function AlignedTextView({
  sourceText,
  translation,
  tokenSeparator = ',',
  maxEditDistance = 3,
  sourceClassName = '',
  translationClassName = '',
  highlightClassName = 'aligned-highlight',
  splitIntoLines = null,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Split translation into tokens
  const translationTokens = useMemo(() => {
    if (!translation) return [];
    return translation
      .split(tokenSeparator)
      .map((token) => token.trim())
      .filter(Boolean);
  }, [translation, tokenSeparator]);

  // Clean source text by removing shloka numbers before alignment
  const cleanedSourceText = useMemo(() => {
    if (!sourceText) return '';
    // Remove numbered endings like "।।6.121.2।।" completely
    return sourceText
      .replace(/।।\d+(?:\.\d+)*।।/g, '')
      .replace(/।।\d+(?:\.\d+)*$/g, '')
      .trim();
  }, [sourceText]);

  // Align source text with translation tokens
  const alignedParts = useMemo(() => {
    if (!cleanedSourceText || translationTokens.length === 0) {
      return [
        {
          text: cleanedSourceText || '',
          startIndex: 0,
          endIndex: (cleanedSourceText || '').length,
          translationIndex: null,
        },
      ];
    }

    return alignTextWithTranslations(cleanedSourceText, translationTokens, {
      maxEditDistance,
    });
  }, [cleanedSourceText, translationTokens, maxEditDistance]);

  // Split aligned parts into lines if splitIntoLines function is provided
  const alignedPartsByLine = useMemo(() => {
    if (!splitIntoLines || !cleanedSourceText) {
      return [alignedParts];
    }

    const lines = splitIntoLines(cleanedSourceText);
    if (lines.length === 0) {
      return [alignedParts];
    }

    // Reconstruct the text from lines to find exact positions
    // This handles cases where the split function might normalize the text
    const normalizedText = cleanedSourceText.replace(/\s+/g, ' ').trim();
    let currentPos = 0;
    const lineRanges = [];

    for (const line of lines) {
      const normalizedLine = line.replace(/\s+/g, ' ').trim();
      // Find where this line starts in the normalized text
      const lineStart = normalizedText.indexOf(normalizedLine, currentPos);
      if (lineStart === -1) {
        // Fallback: use current position
        lineRanges.push({ start: currentPos, end: currentPos + normalizedLine.length });
        currentPos += normalizedLine.length;
      } else {
        const lineEnd = lineStart + normalizedLine.length;
        lineRanges.push({ start: lineStart, end: lineEnd });
        currentPos = lineEnd;
      }
    }

    // Group aligned parts by which line they belong to
    // A part belongs to a line if its midpoint is within the line range
    const partsByLine = [];
    for (const lineRange of lineRanges) {
      const lineParts = alignedParts.filter((part) => {
        const partMidpoint = (part.startIndex + part.endIndex) / 2;
        return partMidpoint >= lineRange.start && partMidpoint < lineRange.end;
      });
      partsByLine.push(lineParts);
    }

    // If no parts were assigned to any line, fall back to single line
    if (partsByLine.every((parts) => parts.length === 0)) {
      return [alignedParts];
    }

    return partsByLine;
  }, [alignedParts, cleanedSourceText, splitIntoLines]);

  // Create a map from translation index to aligned part indices
  const translationToPartsMap = useMemo(() => {
    const map = new Map();
    alignedParts.forEach((part, partIndex) => {
      if (part.translationIndex !== null) {
        if (!map.has(part.translationIndex)) {
          map.set(part.translationIndex, []);
        }
        map.get(part.translationIndex).push(partIndex);
      }
    });
    return map;
  }, [alignedParts]);

  const handlePartHover = (partIndex) => {
    setHoveredIndex(partIndex);
  };

  const handlePartLeave = () => {
    setHoveredIndex(null);
  };

  const isPartHighlighted = (partIndex) => {
    return hoveredIndex === partIndex;
  };

  const isTranslationHighlighted = (translationIndex) => {
    if (hoveredIndex === null) return false;
    const part = alignedParts[hoveredIndex];
    return part && part.translationIndex === translationIndex;
  };

  if (!sourceText || !cleanedSourceText) {
    return null;
  }

  // Find the global index of a part within alignedParts
  const getGlobalPartIndex = (lineIdx, partIdx) => {
    let globalIdx = 0;
    for (let i = 0; i < lineIdx; i++) {
      globalIdx += alignedPartsByLine[i].length;
    }
    return globalIdx + partIdx;
  };

  return (
    <div className="aligned-text-view">
      <div className={`aligned-source-text ${sourceClassName}`}>
        {alignedPartsByLine.map((lineParts, lineIdx) => (
          <div key={lineIdx} className="aligned-line">
            {lineParts.map((part, partIdx) => {
              const globalIdx = getGlobalPartIndex(lineIdx, partIdx);
              return (
                <span
                  key={globalIdx}
                  className={`aligned-part ${
                    isPartHighlighted(globalIdx) ? highlightClassName : ''
                  }`}
                  onMouseEnter={() => handlePartHover(globalIdx)}
                  onMouseLeave={handlePartLeave}
                  style={{
                    cursor: part.translationIndex !== null ? 'pointer' : 'default',
                  }}
                >
                  {part.text}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {translation && translationTokens.length > 0 && (
        <div className={`aligned-translation ${translationClassName}`}>
          {translationTokens.map((token, idx) => (
            <span
              key={idx}
              className={`aligned-token ${
                isTranslationHighlighted(idx) ? highlightClassName : ''
              }`}
            >
              {token}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default AlignedTextView;

