// src/Keyboard.js
import React from 'react';
import './Keyboard.css';

function Keyboard({ isDocked, activeKeys, alphabet, completionResults, onDismiss, onSuggestionClick }) {
  if (isDocked) {
    return null;
  }

  return (
    <div className={`keyboard undocked`}>
      <button 
        className="keyboard-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss keyboard"
        title="Dismiss keyboard"
      >
        ×
      </button>
      <div className="suggestions">
        {completionResults.map((result, index) => (
          <span 
            key={index} 
            className="suggestion-item"
            onClick={() => onSuggestionClick && onSuggestionClick(result)}
          >
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
