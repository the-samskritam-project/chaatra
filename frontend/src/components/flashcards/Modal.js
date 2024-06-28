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
            <h2>{toDevanagiriString(flashcard.title)}</h2>
            <div className="tags">
              {
                flashcard.tags.map((tag, index) => (
                  tag != '' ? (<span id="index" className="tag">{tag}</span>) : <></>
                ))
              }
            </div>
          </div>
          <div className="card-back">
            {flashcard.body.map((item, index) => (
              <div key={index} className="meaning">
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
