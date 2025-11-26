import React from 'react';
import './Ramayana.css';
import { splitShlokaLines } from './shlokaUtils';

const parseDevanagariFromDocument = (document) => {
  if (!document) return '';
  const parts = document.split(' — ');
  if (parts.length >= 2) {
    return parts[1].trim();
  }
  return parts[0].trim();
};

function RamayanaResult({ entry, onClick }) {
  const metadata = entry.metadata || {};
  const devanagari = parseDevanagariFromDocument(entry.devanagariWord);
  const transliteration = metadata.transliteration || entry.transliteratedWord || '';
  const translation = metadata.meaning || entry.englishMeaning || '';
  const explanation = metadata.explanation || '';
  const comments = metadata.comments || '';
  const kanda = metadata.kanda || '';
  const sarga = metadata.sarga;
  const shloka = metadata.shloka;
  const shlokaText = metadata.sanskrit || devanagari;

  return (
    <div className="entry ramayana-entry" onClick={onClick}>
      <div className="entry-main ramayana-heading">
        <div className="ramayana-location">
          {kanda && <span className="ramayana-kanda">{kanda}</span>}
          {(sarga || shloka) && (
            <span className="ramayana-sarga">
              {typeof sarga === 'number' ? `Sarga ${sarga}` : sarga}
              {shloka ? ` • Shloka ${shloka}` : ''}
            </span>
          )}
        </div>
      </div>

      {shlokaText && (
        <div className="ramayana-shloka devanagari-word">
          {splitShlokaLines(shlokaText).map((line, idx) => (
            <span key={`${kanda}-${sarga}-${shloka}-${idx}`} className="shloka-line">
              {line}
            </span>
          ))}
        </div>
      )}

      {transliteration && (
        <div className="ramayana-transliteration">{transliteration}</div>
      )}

      {translation && (
        <div className="ramayana-section">
          <span className="label">Translation</span>
          <p className="english-meaning">{translation}</p>
        </div>
      )}

      {explanation && (
        <div className="ramayana-section">
          <span className="label">Explanation</span>
          <p>{explanation}</p>
        </div>
      )}

      {comments && (
        <div className="ramayana-section">
          <span className="label">Context</span>
          <p>{comments}</p>
        </div>
      )}
    </div>
  );
}

export default RamayanaResult;

