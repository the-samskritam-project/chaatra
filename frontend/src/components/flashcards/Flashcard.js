import React, { useState } from 'react';
import Modal from './Modal'; // Import the Modal component
import { toDevanagiriString } from '../../utils/transliterate';
import FlashCardService from '../../services/FlashCardService';

const Flashcard = ({ flashcard, onDelete, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedTitle, setEditedTitle] = useState(flashcard.title);
  const [editedDescription, setEditedDescription] = useState(flashcard.description || '');
  const flashCardService = new FlashCardService();

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

  const handleTitleClick = (e) => {
    e.stopPropagation();
    setIsEditingTitle(true);
  };

  const handleDescriptionClick = (e) => {
    e.stopPropagation();
    setIsEditingDescription(true);
  };

  const handleTitleChange = (e) => {
    setEditedTitle(e.target.value);
  };

  const handleDescriptionChange = (e) => {
    setEditedDescription(e.target.value);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (editedTitle !== flashcard.title) {
      try {
        const updatedFlashcard = { ...flashcard, title: editedTitle };
        const result = flashCardService.updateFlashCard(flashcard.id, updatedFlashcard);
        onUpdate(result);
      } catch (error) {
        setEditedTitle(flashcard.title);
        console.error('Failed to update title:', error);
      }
    }
  };

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false);
    if (editedDescription !== flashcard.description) {
      try {
        const updatedFlashcard = { ...flashcard, description: editedDescription };
        const result = flashCardService.updateFlashCard(flashcard.id, updatedFlashcard);
        onUpdate(result);
      } catch (error) {
        setEditedDescription(flashcard.description || '');
        console.error('Failed to update description:', error);
      }
    }
  };

  const handleKeyDown = (e, type) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'title') {
        handleTitleBlur();
      } else {
        handleDescriptionBlur();
      }
    } else if (e.key === 'Escape') {
      if (type === 'title') {
        setEditedTitle(flashcard.title);
        setIsEditingTitle(false);
      } else {
        setEditedDescription(flashcard.description || '');
        setIsEditingDescription(false);
      }
    }
  };

  return (
    <div>
      <div onClick={handleOpenModal} className="flashcard-summary">
        <div className="flashcard-header">
          {isEditingTitle ? (
            <input
              type="text"
              value={editedTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => handleKeyDown(e, 'title')}
              className="inline-edit title-edit"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3 onClick={handleTitleClick}>{flashcard.title}</h3>
          )}
          <button onClick={handleDelete} className="delete-button" title="Delete flashcard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        {isEditingDescription ? (
          <input
            type="text"
            value={editedDescription}
            onChange={handleDescriptionChange}
            onBlur={handleDescriptionBlur}
            onKeyDown={(e) => handleKeyDown(e, 'description')}
            className="inline-edit description-edit"
            placeholder="Add description..."
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="description" onClick={handleDescriptionClick}>
            {flashcard.description || <em>Add description...</em>}
          </p>
        )}
        <div className="tags">
          {flashcard.tags && flashcard.tags.map((tag, index) => (
            tag ? <span key={index} className="tag">{tag}</span> : null
          ))}
        </div>
      </div>
      {isModalOpen && (
        <Modal onClose={handleCloseModal} flashcard={flashcard} />
      )}
    </div>
  );
};

export default Flashcard;
