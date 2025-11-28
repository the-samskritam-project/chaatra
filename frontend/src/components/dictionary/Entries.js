import React from 'react';
import emptyStateImage from '../../images/search.webp'; // Import the image
import { toDevanagiriString } from '../../utils/transliterate'; // Add this import

function Entries({ entries, highlightedEntryWord }) {
  // Check if entry is DictionaryEntry format (has Word, Type, Meanings) or Entry format (has devanagariWord, englishMeaning)
  const isDictionaryEntry = (entry) => {
    return entry.hasOwnProperty('word') || entry.hasOwnProperty('Word');
  };

  // Parse devanagariWord string to extract Devanagari word
  // Format: "transliteratedWord — devanagari — meaning"
  const parseDevanagariWord = (devanagariWord) => {
    if (!devanagariWord) return '';
    const parts = devanagariWord.split(' — ');
    // Return the Devanagari part (usually second part, or first if only one part)
    if (parts.length >= 2) {
      return parts[1].trim();
    }
    return parts[0].trim();
  };

  // Parse examples from metadata.examples JSON string
  const parseExamples = (examplesStr) => {
    if (!examplesStr || examplesStr === '[]') return [];
    try {
      const examples = JSON.parse(examplesStr);
      return Array.isArray(examples) ? examples : [];
    } catch (error) {
      console.error('Error parsing examples:', error);
      return [];
    }
  };

  // Render DictionaryEntry format (from /search endpoint)
  const renderDictionaryEntry = (entry, index) => {
    const word = entry.word || entry.Word || '';
    const type = entry.type || entry.Type || '';
    const meanings = entry.meanings || entry.Meanings || [];
    
    // Convert SLP1 to Devanagari
    const devanagariWord = toDevanagiriString(word);
    
    // Check if this entry should be highlighted
    const isHighlighted = highlightedEntryWord && word === highlightedEntryWord;
    
    return (
      <div key={index} className={`entry ${isHighlighted ? 'highlighted' : ''}`}>
        <div className="entry-main">
          <span className="devanagari-word">{devanagariWord}</span>
          {type && (
            <>
              <span className="separator"> ({type})</span>
            </>
          )}
        </div>
        {meanings.length > 0 && (
          <div className="meanings">
            {meanings.map((meaning, meaningIndex) => (
              <div key={meaningIndex} className="meaning">
                <span className="english-meaning">{meaning}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render Entry format (from /v2/search endpoints)
  const renderEntry = (entry, index) => {
    const devanagariWord = parseDevanagariWord(entry.devanagariWord);
    const englishMeaning = entry.englishMeaning || '';
    const examples = parseExamples(entry.metadata?.examples);
    
    return (
      <div key={index} className="entry">
        <div className="entry-main">
          <span className="devanagari-word">{devanagariWord}</span>
          <span className="separator"> - </span>
          <span className="english-meaning">{englishMeaning}</span>
        </div>
        {examples.length > 0 && (
          <div className="examples">
            {examples.map((example, exampleIndex) => (
              <div key={exampleIndex} className="example">
                {example.sanskrit && (
                  <span className="example-sanskrit">{example.sanskrit}</span>
                )}
                {example.source && (
                  <span className="example-source"> ({example.source})</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className='entries'>
      {entries.length > 0 ? (
        entries.map((entry, index) => {
          return isDictionaryEntry(entry) 
            ? renderDictionaryEntry(entry, index)
            : renderEntry(entry, index);
        })
      ) : (
        <div className="empty-state">
          <img src={emptyStateImage} alt="Search!" />
        </div>
      )}
    </div>
  );
}

export default Entries;
