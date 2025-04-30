// src/Keyboard.js
import React from 'react';

function Keyboard({ isDocked, activeKeys, alphabet, completionResults }) {
  return (
    <div className={`keyboard ${isDocked ? 'docked' : 'undocked'}`}>
      <div className="suggestions">
        {completionResults.map((result, index) => (
          <span key={index} className="suggestion-item">
            {result}
          </span>
        ))}
      </div>

      <div className="keys-container">
        {alphabet.map(v => (
          <button
            key={v.key}
            className={`key ${activeKeys.includes(v.key) ? 'selected' : ''}`}
          >
            {v.devanagari} ({v.key})
          </button>
        ))}
      </div>
    </div>
  );
}

export default Keyboard;
