// src/Keyboard.js
import React, { useState } from 'react';

function Keyboard({ isDocked, activeKeys, alphabet, completionResults }) {
  const [poppingKey, setPoppingKey] = useState('');

  return (
    <div className={`keyboard ${isDocked ? 'docked' : 'undocked'}`}>
      <div className="suggestions">
        {completionResults.map((result, index) => (
          <span key={index} className="suggestion-item">
            {result}
          </span>
        ))}
      </div>
      
      {alphabet.map(v => (
        <button
          key={v.key}
          className={`key ${activeKeys.includes(v.key) ? 'selected' : ''} ${poppingKey === v.key ? 'popping' : ''}`}
        >
          {v.devanagari} ({v.key})
        </button>
      ))}
    </div>
  );
}

export default Keyboard;
