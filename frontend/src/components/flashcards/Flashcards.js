import Flashcard from './Flashcard';
import React, { useState, useEffect } from 'react';
import './Flashcards.css'
import AddModal from './AddModal';
import FlashCardService from '../../services/FlashCardService';

const flashCardService = new FlashCardService();

const Flashcards = () => {
  const [flashcards, setFlashcards] = useState([]);

  useEffect(() => {
    setFlashcards(getFlashcards());
  }, []);

  const [showModal, setShowModal] = useState(false);

  const handleAddButtonClick = () => {
    setShowModal(true);
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

  const flashcardAdded = (card) => {
    const newCard = flashCardService.createFlashCard(card);
    setFlashcards(prevCards => [...prevCards, newCard]);
  }

  return (
    <div className="flashcards-container">
      <div className="flashcards-header">
        <button className="flashcard-add-button" onClick={handleAddButtonClick}>
          Add
        </button>
      </div>
      <div className="flashcards-list">
        {flashcards.map((flashcard, index) => (
          <Flashcard 
            key={flashcard.id} 
            flashcard={flashcard} 
            onDelete={handleDeleteFlashcard}
            onUpdate={handleUpdateFlashcard}
          />
        ))}
      </div>
      {showModal && <AddModal setShowModal={setShowModal} handleAddCard={flashcardAdded} />}
    </div>
  );
};

const getFlashcards = () => {
  const cards = flashCardService.getFlashCards();
  return cards;
};

export default Flashcards;