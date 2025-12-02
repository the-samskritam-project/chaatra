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
 * @param {string} props.sourceClassName - CSS class for source text container
 * @param {string} props.translationClassName - CSS class for translation container
 * @param {string} props.highlightClassName - CSS class for highlighted elements
 * @param {Function} props.splitIntoLines - Optional function to split source text into lines
 */
function AlignedTextView({
  sourceText,
  translation,
  tokenSeparator = ',',
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

    return alignTextWithTranslations(cleanedSourceText, translationTokens, {});
  }, [cleanedSourceText, translationTokens]);

  // Split aligned parts into lines based on | delimiter position
  const alignedPartsByLine = useMemo(() => {
    if (!splitIntoLines || !cleanedSourceText) {
      return [alignedParts];
    }

    // Use splitIntoLines to get the lines
    const lines = splitIntoLines(cleanedSourceText);
    if (lines.length === 0) {
      return [alignedParts];
    }

    // Normalize the cleaned text for matching
    const normalizedText = cleanedSourceText.replace(/\s+/g, ' ').trim();
    
    // Find delimiter position by matching the first line (without delimiter) in the normalized text
    let delimiterIndex = -1;
    if (lines.length > 0) {
      const firstLine = lines[0].replace(/\s+/g, ' ').trim();
      // Remove delimiter from first line to find the content
      const firstLineContent = firstLine.replace(/\s*\|\s*$/, '').trim();
      
      // Find where first line content ends in normalized text
      const contentIndex = normalizedText.indexOf(firstLineContent);
      if (contentIndex !== -1) {
        delimiterIndex = contentIndex + firstLineContent.length;
      }
    }
    
    // Fallback: look for | in normalized text
    if (delimiterIndex === -1) {
      delimiterIndex = normalizedText.indexOf('|');
    }
    
    if (delimiterIndex === -1 || delimiterIndex >= normalizedText.length) {
      // No delimiter found or invalid position, return all parts as single line
      return [alignedParts];
    }

    // Group parts by line: parts before delimiter belong to first line, after to second
    const firstLineParts = [];
    const secondLineParts = [];

    for (const part of alignedParts) {
      // Check if part belongs to first line (before delimiter) or second line (after delimiter)
      if (part.startIndex < delimiterIndex) {
        // Part is in first line
        if (part.endIndex <= delimiterIndex) {
          // Part is fully in first line
          firstLineParts.push(part);
        } else {
          // Part spans across delimiter - split it
          const firstPartLength = delimiterIndex - part.startIndex;
          firstLineParts.push({
            ...part,
            text: part.text.substring(0, firstPartLength),
            endIndex: delimiterIndex,
          });
          secondLineParts.push({
            ...part,
            text: part.text.substring(firstPartLength),
            startIndex: delimiterIndex,
          });
        }
      } else {
        // Part is in second line
        secondLineParts.push(part);
      }
    }

    const partsByLine = [];
    if (firstLineParts.length > 0) {
      partsByLine.push(firstLineParts);
    }
    if (secondLineParts.length > 0) {
      partsByLine.push(secondLineParts);
    }

    return partsByLine.length > 0 ? partsByLine : [alignedParts];
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

  // Get original shloka lines for display (must be before early return)
  const shlokaLines = useMemo(() => {
    if (!splitIntoLines || !cleanedSourceText) {
      return cleanedSourceText ? [cleanedSourceText] : [];
    }
    return splitIntoLines(cleanedSourceText);
  }, [cleanedSourceText, splitIntoLines]);

  // Find the global index of a part within alignedParts
  const getGlobalPartIndex = (lineIdx, partIdx) => {
    let globalIdx = 0;
    for (let i = 0; i < lineIdx; i++) {
      globalIdx += alignedPartsByLine[i].length;
    }
    return globalIdx + partIdx;
  };

  if (!sourceText || !cleanedSourceText) {
    return null;
  }

  return (
    <div className="aligned-text-view">
      <div className="aligned-cards-container">
        {/* Shloka card on the left */}
        <div className="aligned-shloka-card">
          <div className="aligned-card-label">Original</div>
          <div className={`aligned-shloka-text ${sourceClassName}`}>
            {shlokaLines.map((line, lineIdx) => (
              <div key={lineIdx} className="aligned-shloka-line">
                {line}
              </div>
            ))}
          </div>
        </div>

        {/* Aligned splits on the right */}
        <div className="aligned-splits-container">
          <div className="aligned-card-label">Split by sandhi</div>
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
                {/* Add delimiter at end of line: | for first line, || for second line */}
                {lineIdx === 0 && alignedPartsByLine.length > 1 && (
                  <span className="aligned-delimiter"> |</span>
                )}
                {lineIdx === 1 && (
                  <span className="aligned-delimiter"> ||</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Translation labels below, spanning full width */}
      {translation && translationTokens.length > 0 && (
        <div className={`aligned-translation-container ${translationClassName}`}>
          <div className="aligned-translation">
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
        </div>
      )}
    </div>
  );
}

export default AlignedTextView;

