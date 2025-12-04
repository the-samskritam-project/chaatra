import React from 'react';
import './Hitopadesa.css';

function HitopadesaVerse({ verse }) {
  const splitDevanagariLines = (text) => {
    if (!text) return [];
    return text.split('\n').filter((line) => line.trim());
  };

  return (
    <div className="hitopadesa-verse">
      <div className="hitopadesa-verse-header">
        <span className="hitopadesa-verse-number">Verse {verse.verse_index}</span>
        <span className="hitopadesa-verse-id">{verse.verse_number}</span>
      </div>

      {verse.transliterated_devanagari && (
        <div className="hitopadesa-devanagari">
          {splitDevanagariLines(verse.transliterated_devanagari).map((line, idx) => (
            <div key={`devanagari-${verse.verse_number}-${idx}`} className="hitopadesa-line">
              {line}
            </div>
          ))}
        </div>
      )}

      {verse.original_iast && (
        <div className="hitopadesa-iast">{verse.original_iast}</div>
      )}

      {verse.word_by_word_translation && verse.word_by_word_translation.length > 0 && (
        <div className="hitopadesa-word-by-word">
          <span className="hitopadesa-label">Word-by-word:</span>
          <div className="hitopadesa-word-list">
            {verse.word_by_word_translation.map((item, idx) => (
              <span key={`word-${verse.verse_number}-${idx}`} className="hitopadesa-word-item">
                <span className="hitopadesa-word">{item.word}</span>
                <span className="hitopadesa-word-translation">({item.translation})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {verse.full_translation && (
        <div className="hitopadesa-translation">
          <span className="hitopadesa-label">Translation:</span>
          <p className="hitopadesa-translation-text">{verse.full_translation}</p>
        </div>
      )}
    </div>
  );
}

export default HitopadesaVerse;

