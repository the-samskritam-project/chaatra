import React, { useState, useEffect } from 'react';
import './AdityaHridaya.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';

function AdityaHridaya() {
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedWordByWord, setExpandedWordByWord] = useState({});

  useEffect(() => {
    fetchVerses();
  }, []);

  const splitShlokas = (verses) => {
    const splitVerses = [];
    
    verses.forEach((verse) => {
      // Split by shloka number pattern: ।।6.107.X।।
      const shlokaPattern = /(।।6\.107\.\d+।।)/g;
      const text = verse.shloka_text;
      
      // Find all shloka markers with their positions
      const matches = [];
      let match;
      while ((match = shlokaPattern.exec(text)) !== null) {
        matches.push({
          marker: match[0],
          index: match.index,
          shlokaNum: parseInt(match[0].match(/6\.107\.(\d+)/)[1], 10)
        });
      }
      
      if (matches.length === 0) {
        // No markers found, treat as single shloka
        splitVerses.push(verse);
        return;
      }
      
      // Split text by shloka markers
      let lastIndex = 0;
      matches.forEach((matchInfo) => {
        // Get text from lastIndex to the end of this marker (inclusive)
        const shlokaText = text.substring(lastIndex, matchInfo.index + matchInfo.marker.length).trim();
        
        if (shlokaText) {
          splitVerses.push({
            ...verse,
            _id: `${verse._id}_${matchInfo.shlokaNum}`,
            shloka: matchInfo.shlokaNum,
            shloka_text: shlokaText,
          });
        }
        
        // Move past this marker
        lastIndex = matchInfo.index + matchInfo.marker.length;
      });
      
      // Handle any remaining text after the last marker
      if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex).trim();
        if (remainingText) {
          const lastShlokaNum = matches[matches.length - 1].shlokaNum + 1;
          splitVerses.push({
            ...verse,
            _id: `${verse._id}_${lastShlokaNum}`,
            shloka: lastShlokaNum,
            shloka_text: remainingText,
          });
        }
      }
    });
    
    // Deduplicate by shloka number (keep first occurrence)
    const seen = new Set();
    const uniqueVerses = [];
    splitVerses.forEach((verse) => {
      if (!seen.has(verse.shloka)) {
        seen.add(verse.shloka);
        uniqueVerses.push(verse);
      }
    });
    
    // Sort by shloka number
    return uniqueVerses.sort((a, b) => a.shloka - b.shloka);
  };

  const groupVersesByTranslation = (verses) => {
    // Group verses by their translation text
    const groups = {};
    verses.forEach((verse) => {
      const translationKey = verse.translation || verse.explanation || '';
      if (!groups[translationKey]) {
        groups[translationKey] = [];
      }
      groups[translationKey].push(verse);
    });
    
    // Convert groups to array format
    return Object.values(groups).map((group) => ({
      verses: group.sort((a, b) => a.shloka - b.shloka),
      translation: group[0].translation,
      explanation: group[0].explanation,
      transliteration: group[0].transliteration,
    }));
  };

  const fetchVerses = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/v2/aditya_hridaya_stotra/verses`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch verses: ${response.statusText}`);
      }
      
      const data = await response.json();
      const splitData = splitShlokas(data);
      const groupedData = groupVersesByTranslation(splitData);
      setVerses(groupedData);
      setError(null);
    } catch (err) {
      console.error('Error fetching Aditya Hridaya Stotra:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="aditya-hridaya-container">
        <div className="aditya-hridaya-loading">Loading Aditya Hridaya Stotra...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aditya-hridaya-container">
        <div className="aditya-hridaya-error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="aditya-hridaya-container">
      <div className="aditya-hridaya-header">
        <h1>Aditya Hridaya Stotra</h1>
        <p className="aditya-hridaya-subtitle">
          Yuddha Kanda, Sarga 107 • {verses.reduce((sum, group) => sum + group.verses.length, 0)} shlokas
        </p>
      </div>
      
      <div className="aditya-hridaya-verses">
        {verses.map((group, groupIndex) => (
          <div key={groupIndex} className="aditya-hridaya-verse">
            <div className="aditya-hridaya-verse-number">
              {group.verses.length > 1 
                ? `Verses ${group.verses.map(v => v.shloka).join(', ')}`
                : `Verse ${group.verses[0].shloka}`
              }
            </div>
            <div className="aditya-hridaya-verse-content">
              <div className="aditya-hridaya-sanskrit">
                {group.verses.map((verse, verseIndex) => (
                  <div key={verse._id || verseIndex} className="aditya-hridaya-sanskrit-verse-group">
                    {verseIndex > 0 && <div className="aditya-hridaya-verse-gap" />}
                    <div className="aditya-hridaya-sanskrit-text">
                      {verse.shloka_text
                        // Replace shloka number markers like "6.107.1।।" with just "।।"
                        .replace(/।।6\.107\.\d+।।/g, '।।')
                        .split(/\s+।\s+/)
                        .filter(line => line.trim().length > 0)
                        .map((line, idx, arr) => {
                          const trimmed = line.trim();
                          // Add danda back to all lines except the last one
                          if (idx < arr.length - 1) {
                            return trimmed + ' ।';
                          }
                          return trimmed;
                        })
                        .map((line, idx) => (
                          <div key={idx} className="aditya-hridaya-sanskrit-line">
                            {line}
                          </div>
                        ))}
                    </div>
                    {verse.transliteration && (
                      <div className="aditya-hridaya-transliteration">
                        {verse.transliteration}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="aditya-hridaya-translation">
                {/* Full translation (explanation) first */}
                {group.explanation && (
                  <div className="aditya-hridaya-explanation">
                    {group.explanation}
                  </div>
                )}
                
                {/* Word-by-word translation in collapsible - at the end */}
                {group.translation && (
                  <div className="aditya-hridaya-word-by-word">
                    <button
                      className="aditya-hridaya-word-by-word-toggle"
                      onClick={() => setExpandedWordByWord(prev => ({
                        ...prev,
                        [groupIndex]: !prev[groupIndex]
                      }))}
                      aria-expanded={expandedWordByWord[groupIndex] || false}
                      aria-label="Toggle word-by-word translation"
                    >
                      <span className="aditya-hridaya-toggle-icon">
                        {expandedWordByWord[groupIndex] ? '▼' : '▶'}
                      </span>
                      <span className="aditya-hridaya-word-by-word-label">Word-by-word translation</span>
                    </button>
                    {expandedWordByWord[groupIndex] && (
                      <div className="aditya-hridaya-word-by-word-content">
                        <div className="aditya-hridaya-word-list">
                          {group.translation
                            .split(',')
                            .map((item, idx) => {
                              const trimmed = item.trim();
                              if (!trimmed) return null;
                              
                              // Split by space to separate Sanskrit word from translation
                              const parts = trimmed.split(/\s+/);
                              if (parts.length < 2) {
                                // If no space, treat entire string as word
                                return (
                                  <div key={idx} className="aditya-hridaya-word-item">
                                    <span className="aditya-hridaya-word">{trimmed}</span>
                                  </div>
                                );
                              }
                              
                              // First part is Sanskrit, rest is translation
                              const sanskritWord = parts[0];
                              const translation = parts.slice(1).join(' ');
                              
                              return (
                                <div key={idx} className="aditya-hridaya-word-item">
                                  <span className="aditya-hridaya-word">{sanskritWord}</span>
                                  <span className="aditya-hridaya-word-translation">{translation}</span>
                                </div>
                              );
                            })
                            .filter(Boolean)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdityaHridaya;

