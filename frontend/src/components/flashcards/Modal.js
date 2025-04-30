import React, { useState } from 'react';

const Modal = ({ onClose, flashcard }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className={`card ${isFlipped ? 'flipped' : ''}`}>
          <div className="card-inner">
            <div className="card-front" onClick={handleFlip}>
              <div className="card-content">
                <p>{flashcard.front}</p>
              </div>
            </div>
            <div className="card-back" onClick={handleFlip}>
              <div className="card-content">
                <p>{flashcard.back}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
