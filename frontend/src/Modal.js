import React, { useState } from 'react';
import './Modal.css'; // Ensure you create and style the modal in this CSS file

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
            <h2>{flashcard.title}</h2>
            <div className="tags">
              {flashcard.tags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          </div>
          <div className="card-back">
            <p>{flashcard.content}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
