import React, { useState, useEffect } from 'react';
import FlashCardService from '../../services/FlashCardService';

const flashCardService = new FlashCardService();

const Modal = ({ onClose, flashcard, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [front, setFront] = useState(flashcard.front);
  const [back, setBack] = useState(flashcard.back);
  const [currentFace, setCurrentFace] = useState('Front');

  // Update local state when flashcard prop changes
  useEffect(() => {
    setFront(flashcard.front);
    setBack(flashcard.back);
  }, [flashcard]);

  const handleFlip = (e) => {
    e.stopPropagation();
    if (isEditing) return;
    setCurrentFace(currentFace === 'Front' ? 'Back' : 'Front');
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditedText(currentFace === 'Front' ? front : back);
  };

  const handleSave = () => {
    if (currentFace === 'Front') {
      setFront(editedText);
    } else {
      setBack(editedText);
    }

    const updatedFlashcard = {
      ...flashcard,
      front: currentFace === 'Front' ? editedText : front,
      back: currentFace === 'Back' ? editedText : back
    };
    
    try {
      const result = flashCardService.updateFlashCard(flashcard.id, updatedFlashcard);
      if (onUpdate) {
        onUpdate(result);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update flashcard:', error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const renderContent = () => {
    const text = currentFace === 'Front' ? front : back;
    
    if (isEditing) {
      return (
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="card-edit"
          placeholder={`Enter ${currentFace.toLowerCase()} text...`}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    return (
      <p className="editable" onClick={handleEdit}>
        {text || `Click to add ${currentFace.toLowerCase()} text...`}
      </p>
    );
  };

  const handleCardClick = (e) => {
    // If we're not editing, flip the card
    if (!isEditing) {
      handleFlip(e);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className={`card ${currentFace === 'Back' ? 'flipped' : ''}`}>
          <div className="card-inner">
            <div className="card-front" onClick={handleCardClick}>
              <div className="card-content">
                {renderContent()}
                <p className="face-text">{currentFace}</p>
              </div>
            </div>
            <div className="card-back" onClick={handleCardClick}>
              <div className="card-content">
                {renderContent()}
                <p className="face-text">{currentFace}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
