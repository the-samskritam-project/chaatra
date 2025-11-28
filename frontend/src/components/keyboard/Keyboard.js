// src/Keyboard.js
import React from 'react';
import './Keyboard.css';

function Keyboard({ isDocked, activeKeys, alphabet, completionResults, onDismiss, onSuggestionClick }) {
  if (isDocked) {
    return null;
  }

  // Debug logging
  console.log('Keyboard render - isDocked:', isDocked, 'completionResults:', completionResults);

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
        {completionResults && completionResults.length > 0 ? (
          completionResults.map((result, index) => {
            // Extract just the word part if it contains " — " (meaning separator)
            const displayText = result.split(' — ')[0].trim();
            return (
              <span 
                key={index} 
                className="suggestion-item"
                onClick={() => onSuggestionClick && onSuggestionClick(result)}
                title={result} // Show full text on hover
              >
                {displayText}
              </span>
            );
          })
        ) : (
          <span className="suggestions-placeholder" style={{ color: '#999', fontSize: '12px' }}>
            Type to see suggestions...
          </span>
        )}
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
