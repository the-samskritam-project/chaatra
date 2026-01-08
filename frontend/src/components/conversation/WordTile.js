import React from 'react';
import './WordTile.css';

const WordTile = ({
  word,
  index,
  isUncompoundedRevealed,
  isMeaningRevealed,
  uncompoundedParts,
  meanings,
  onClick,
  disabled,
}) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick(index);
    }
  };

  return (
    <div
      className={`word-tile ${isUncompoundedRevealed ? 'uncompounded-revealed' : ''} ${isMeaningRevealed ? 'meaning-revealed' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
    >
      <div className="word-tile-content">
        {/* Default state: Show original word */}
        {!isUncompoundedRevealed && (
          <div className="word-tile-original">
            <span className="word-tile-text">{word}</span>
            <span className="word-tile-index">[{index}]</span>
          </div>
        )}

        {/* Uncompounded revealed: Show uncompounded parts */}
        {isUncompoundedRevealed && (
          <div className="word-tile-uncompounded">
            <div className="word-tile-uncompounded-parts">
              {uncompoundedParts && uncompoundedParts.length > 0 ? (
                uncompoundedParts.map((part, idx) => (
                  <span key={idx} className="word-tile-part">
                    {part}
                    {isMeaningRevealed && meanings && meanings[idx] && (
                      <span className="word-tile-meaning"> ({meanings[idx]})</span>
                    )}
                    {idx < uncompoundedParts.length - 1 && (
                      <span className="word-tile-separator"> - </span>
                    )}
                  </span>
                ))
              ) : (
                <span className="word-tile-text">{word}</span>
              )}
            </div>
            <span className="word-tile-index">[{index}]</span>
          </div>
        )}

        {/* Visual indicator for revealed state */}
        {isUncompoundedRevealed && (
          <div className="word-tile-indicator">
            {isMeaningRevealed ? '✓✓' : '✓'}
          </div>
        )}
      </div>
    </div>
  );
};

export default WordTile;

