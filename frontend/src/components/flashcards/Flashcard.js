import React, { useState, useEffect } from 'react';
import Modal from './Modal'; // Import the Modal component
import FlashCardService from '../../services/FlashCardService';
import './Flashcards.css';

const Flashcard = ({ flashcard, onDelete, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(flashcard.title);
  const [editedDescription, setEditedDescription] = useState(flashcard.description || '');
  const [editedTags, setEditedTags] = useState(flashcard.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [currentFlashcard, setCurrentFlashcard] = useState(flashcard);
  const flashCardService = new FlashCardService();

  // Update currentFlashcard when flashcard prop changes
  useEffect(() => {
    setCurrentFlashcard(flashcard);
  }, [flashcard]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(flashcard.id); 
  };

  const handleTitleClick = () => {
    setIsEditing(true);
  };

  const handleTitleChange = (e) => {
    setEditedTitle(e.target.value);
  };

  const handleDescriptionChange = (e) => {
    setEditedDescription(e.target.value);
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTags = [...editedTags, tagInput.trim()];
      setEditedTags(newTags);
      setTagInput('');
      setShowTagInput(false);
      // Save immediately when adding a tag
      const updatedFlashcard = {
        ...currentFlashcard,
        tags: newTags
      };
      const result = flashCardService.updateFlashCard(currentFlashcard.id, updatedFlashcard);
      setCurrentFlashcard(result);
      onUpdate(result);
    } else if (e.key === 'Escape') {
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setEditedTags(editedTags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    const updatedFlashcard = {
      ...currentFlashcard,
      title: editedTitle,
      description: editedDescription,
      tags: editedTags
    };
    const result = flashCardService.updateFlashCard(currentFlashcard.id, updatedFlashcard);
    setCurrentFlashcard(result);
    onUpdate(result);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(currentFlashcard.title);
    setEditedDescription(currentFlashcard.description || '');
    setEditedTags(currentFlashcard.tags || []);
    setIsEditing(false);
  };

  const handleModalUpdate = (updatedFlashcard) => {
    setCurrentFlashcard(updatedFlashcard);
    onUpdate(updatedFlashcard);
  };

  return (
    <div>
      <div onClick={handleOpenModal} className="flashcard-summary">
        <div className="flashcard-header">
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={handleTitleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                } else if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
              className="inline-edit title-edit"
              autoFocus
            />
          ) : (
            <h3 onClick={handleTitleClick}>{currentFlashcard.title}</h3>
          )}
          <button onClick={handleDelete} className="delete-button" title="Delete flashcard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        {isEditing ? (
          <input
            type="text"
            value={editedDescription}
            onChange={handleDescriptionChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
            className="inline-edit description-edit"
          />
        ) : (
          <p className="description">
            {currentFlashcard.description || <em>No description</em>}
          </p>
        )}
        <div className="tags-container">
          <div className="tags-list">
            {editedTags.map((tag, index) => (
              <span key={index} className="tag">
                {tag}
                <button
                  className="tag-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(tag);
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="tag-input-container">
            {showTagInput ? (
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                className="tag-input"
                placeholder="Add tags..."
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <button 
                className="tag-add-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTagInput(true);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            {showTagInput && (
              <button 
                className="tag-add-button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (tagInput.trim()) {
                    const newTags = [...editedTags, tagInput.trim()];
                    setEditedTags(newTags);
                    setTagInput('');
                    setShowTagInput(false);
                    // Save immediately when adding a tag
                    const updatedFlashcard = {
                      ...currentFlashcard,
                      tags: newTags
                    };
                    const result = flashCardService.updateFlashCard(currentFlashcard.id, updatedFlashcard);
                    setCurrentFlashcard(result);
                    onUpdate(result);
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        {isEditing && (
          <div className="new-card-actions">
            <button onClick={handleSave} className="save-button">Save</button>
            <button onClick={handleCancel} className="cancel-button">Cancel</button>
          </div>
        )}
      </div>
      {isModalOpen && (
        <Modal 
          onClose={handleCloseModal} 
          flashcard={currentFlashcard} 
          onUpdate={handleModalUpdate}
        />
      )}
    </div>
  );
};

export default Flashcard;
