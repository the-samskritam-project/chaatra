import React, { useState, useEffect } from 'react';
import FlashCardService from '../../services/FlashCardService';
import KeyboardBridge from '../keyboard/KeyboardBridge';
import { toDevanagiriString } from '../../utils/transliterate';

const flashCardService = new FlashCardService();

const Modal = ({ onClose, flashcard, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [front, setFront] = useState(flashcard.front);
  const [back, setBack] = useState(flashcard.back);
  const [currentFace, setCurrentFace] = useState('Front');
  const [isFocused, setIsFocused] = useState(false);
  const [keyboardType, setKeyboardType] = useState('devanagari');
  const [rawInput, setRawInput] = useState('');
  const [currentDevStr, setCurrentDevStr] = useState('');

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

  const handleInput = ({ type, value }) => {
    if (type === 'enter') {
      handleSave();
      return;
    }

    if (keyboardType === 'devanagari') {
      if (type === 'backspace') {
        setCurrentDevStr(prev => prev.slice(0, -1));
        setEditedText(prev => prev.slice(0, -1));
      } else if (type === 'key') {
        const newDevStr = currentDevStr + value.slice(-1);
        setCurrentDevStr(newDevStr);
        const devanagari = toDevanagiriString(newDevStr);
        setEditedText(prev => prev + devanagari);
      }
      return;
    }

    // QWERTY mode
    if (type === 'backspace') {
      setRawInput(prev => prev.slice(0, -1));
      setEditedText(prev => prev.slice(0, -1));
    } else if (type === 'key') {
      setRawInput(value);
      setEditedText(value);
    }
  };

  const handleTextareaChange = (e) => {
    if (keyboardType === 'qwerty') {
      setEditedText(e.target.value);
      setRawInput(e.target.value);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleKeyboardTypeChange = (type) => {
    setKeyboardType(type);
    if (type === 'devanagari') {
      setCurrentDevStr('');
      return;
    }
    setRawInput(editedText);
  };

  const renderContent = () => {
    const text = currentFace === 'Front' ? front : back;
    
    if (isEditing) {
      return (
        <div className="card-edit-container">
          <textarea
            value={editedText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            className="card-edit"
            placeholder={`Enter ${currentFace.toLowerCase()} text...`}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          <div className="keyboard-toggle">
            <button 
              className={`keyboard-type-btn ${keyboardType === 'devanagari' ? 'active' : ''}`}
              onClick={() => handleKeyboardTypeChange('devanagari')}
              title="Devanagari Keyboard"
            >
              <span className="devanagari-icon">देव</span>
            </button>
            <button 
              className={`keyboard-type-btn ${keyboardType === 'qwerty' ? 'active' : ''}`}
              onClick={() => handleKeyboardTypeChange('qwerty')}
              title="QWERTY Keyboard"
            >
              <span className="qwerty-icon">ABC</span>
            </button>
          </div>
          {keyboardType === 'devanagari' && (
            <KeyboardBridge
              isFocused={isFocused}
              onInput={handleInput}
              value={rawInput}
            />
          )}
        </div>
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
