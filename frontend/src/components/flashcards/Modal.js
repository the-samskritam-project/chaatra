import React, { useState, useEffect } from 'react';
import FlashCardService from '../../services/FlashCardService';

const flashCardService = new FlashCardService();

const Modal = ({ onClose, flashcard, onUpdate }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [front, setFront] = useState(flashcard.front);
  const [back, setBack] = useState(flashcard.back);
  const [editingFace, setEditingFace] = useState(null);
  const currentFace = isFlipped ? 'Back' : 'Front';

  // Update local state when flashcard prop changes
  useEffect(() => {
    setFront(flashcard.front);
    setBack(flashcard.back);
  }, [flashcard]);

  const handleFlip = (e) => {
    e.stopPropagation();
    if (isEditing) return;
    setIsFlipped(!isFlipped);
  };

  const handleEdit = (e, face) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingFace(face);
    setEditedText(face === 'Front' ? front : back);
  };

  const handleSave = () => {
    // Create a new object with the current state
    const updatedFlashcard = {
      ...flashcard,
      front: front,
      back: back
    };

    // Update the appropriate side
    if (editingFace === 'Front') {
      updatedFlashcard.front = editedText;
      setFront(editedText);
    } else {
      updatedFlashcard.back = editedText;
      setBack(editedText);
    }
    
    try {
      const result = flashCardService.updateFlashCard(flashcard.id, updatedFlashcard);
      if (onUpdate) {
        onUpdate(result);
      }
      setIsEditing(false);
      setEditingFace(null);
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
      setEditingFace(null);
    }
  };

  const renderContent = (text, face) => {
    if (isEditing && editingFace === face) {
      return (
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="card-edit"
          placeholder={`Enter ${face.toLowerCase()} text...`}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    return (
      <p className="editable" onClick={(e) => handleEdit(e, face)}>
        {text || `Click to add ${face.toLowerCase()} text...`}
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
        <div className={`card ${isFlipped ? 'flipped' : ''}`}>
          <div className="card-inner">
            <div className="card-front" onClick={handleCardClick}>
              <div className="card-content">
                {renderContent(front, 'Front')}
                <p className="face-text">{currentFace}</p>
              </div>
            </div>
            <div className="card-back" onClick={handleCardClick}>
              <div className="card-content">
                {renderContent(back, 'Back')}
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
