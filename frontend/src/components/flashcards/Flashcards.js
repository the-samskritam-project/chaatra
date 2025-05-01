import Flashcard from './Flashcard';
import React, { useState, useEffect } from 'react';
import './Flashcards.css'
import FlashCardService from '../../services/FlashCardService';

const flashCardService = new FlashCardService();

const Flashcards = () => {
  const [flashcards, setFlashcards] = useState([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCard, setNewCard] = useState({
    title: '',
    description: '',
    tags: []
  });
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  useEffect(() => {
    setFlashcards(getFlashcards());
  }, []);

  const handleAddButtonClick = () => {
    setIsAddingNew(true);
    setNewCard({
      title: '',
      description: '',
      tags: []
    });
  };

  const handleDeleteFlashcard = (id) => {
    flashCardService.deleteFlashCard(id);
    setFlashcards(flashcards => flashcards.filter(flashcard => flashcard.id !== id));
  };

  const handleUpdateFlashcard = (updatedFlashcard) => {
    setFlashcards(flashcards => 
      flashcards.map(flashcard => 
        flashcard.id === updatedFlashcard.id ? updatedFlashcard : flashcard
      )
    );
  };

  const handleNewCardChange = (field, value) => {
    setNewCard(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNewCardSave = () => {
    if (newCard.title.trim()) {
      const savedCard = flashCardService.createFlashCard(newCard);
      setFlashcards(prevCards => [...prevCards, savedCard]);
      setIsAddingNew(false);
    }
  };

  const handleNewCardCancel = () => {
    setIsAddingNew(false);
  };

  const handleNewCardKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNewCardSave();
    } else if (e.key === 'Escape') {
      handleNewCardCancel();
    }
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTags = [...newCard.tags, tagInput.trim()];
      setNewCard(prev => ({ ...prev, tags: newTags }));
      setTagInput('');
      setShowTagInput(false);
    } else if (e.key === 'Escape') {
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setNewCard(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  return (
    <div className="flashcards-container">
      <div className="flashcards-list">
        {isAddingNew && (
          <div className="flashcard-summary new-card">
            <div className="flashcard-header">
              <input
                type="text"
                value={newCard.title}
                onChange={(e) => handleNewCardChange('title', e.target.value)}
                onKeyDown={handleNewCardKeyDown}
                className="inline-edit title-edit"
                placeholder="Title"
                autoFocus
              />
            </div>
            <input
              type="text"
              value={newCard.description}
              onChange={(e) => handleNewCardChange('description', e.target.value)}
              onKeyDown={handleNewCardKeyDown}
              className="inline-edit description-edit"
              placeholder="Description"
            />
            <div className="tags-container">
              <div className="tags-list">
                {newCard.tags.map((tag, index) => (
                  <span key={index} className="tag">
                    {tag}
                    <button
                      className="tag-remove"
                      onClick={() => handleRemoveTag(tag)}
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
                    autoFocus
                  />
                ) : (
                  <button 
                    className="tag-add-button"
                    onClick={() => setShowTagInput(true)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
                {showTagInput && (
                  <button 
                    className="tag-add-button"
                    onClick={() => {
                      if (tagInput.trim()) {
                        const newTags = [...newCard.tags, tagInput.trim()];
                        setNewCard(prev => ({ ...prev, tags: newTags }));
                        setTagInput('');
                        setShowTagInput(false);
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
            <div className="new-card-actions">
              <button onClick={handleNewCardSave} className="save-button">Save</button>
              <button onClick={handleNewCardCancel} className="cancel-button">Cancel</button>
            </div>
          </div>
        )}
        {flashcards.map((flashcard) => (
          <Flashcard 
            key={flashcard.id} 
            flashcard={flashcard} 
            onDelete={handleDeleteFlashcard}
            onUpdate={handleUpdateFlashcard}
          />
        ))}
        {!isAddingNew && (
          <div className="flashcard-summary add-card-placeholder" onClick={handleAddButtonClick}>
            <div className="add-card-content">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>Add</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const getFlashcards = () => {
  const cards = flashCardService.getFlashCards();
  return cards;
};

export default Flashcards;