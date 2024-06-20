import React, { useState } from 'react';
import { toDevanagiriString } from '../../utils/transliterate';

const Modal = ({ onClose, flashcard }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className={`card ${isFlipped ? 'flipped' : ''}`} onClick={handleFlip}>
          <div className="card-front">
            <h2>{toDevanagiriString(flashcard.Word)}</h2>
            <div className="tags">
              <span className="tag">{flashcard.Type}</span>
            </div>
          </div>
          <div className="card-back">
            {flashcard.Meanings.map((meaning, meaningIndex) => (
              <div key={meaningIndex} className="meaning">
                <p>{meaning}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
