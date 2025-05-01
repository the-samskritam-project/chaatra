import React, { useState } from 'react';
import Modal from './Modal'; // Import the Modal component
import { toDevanagiriString } from '../../utils/transliterate';
import FlashCardService from '../../services/FlashCardService';

const Flashcard = ({ flashcard, onDelete, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(flashcard.title);
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

  const handleTitleChange = (e) => {
    setEditedTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (editedTitle !== flashcard.title) {
      try {
        const updatedFlashcard = { ...flashcard, title: editedTitle };
        const result = flashCardService.updateFlashCard(flashcard.id, updatedFlashcard);
        onUpdate(result); // Notify parent of the update
      } catch (error) {
        // If update fails, revert to original title
        setEditedTitle(flashcard.title);
        console.error('Failed to update title:', error);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleBlur();
    } else if (e.key === 'Escape') {
      setEditedTitle(flashcard.title);
      setIsEditingTitle(false);
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
              onKeyDown={handleKeyDown}
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
        {flashcard.description && (
          <p className="description">{flashcard.description}</p>
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
