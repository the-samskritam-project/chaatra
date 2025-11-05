import React from 'react';
import emptyStateImage from '../../images/search.webp'; // Import the image

function Entries({ entries }) {
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

  return (
    <div className='entries'>
      {entries.length > 0 ? (
        entries.map((entry, index) => {
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
