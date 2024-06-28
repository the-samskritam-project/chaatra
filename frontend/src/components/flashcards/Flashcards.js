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

  const handleDeleteFlashcard = (title) => {
    flashCardService.deleteFlashCard(title);
    setFlashcards(flashcards => flashcards.filter(flashcard => flashcard.title !== title));
  };

  const flashcardAdded = (card) => {
    flashCardService.createFlashCard(card);
    flashcards.push(card);
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
          <Flashcard key={index} flashcard={flashcard} onDelete={handleDeleteFlashcard} />
        ))}
      </div>
      {showModal && <AddModal setShowModal={setShowModal} handleAddCard={flashcardAdded} />}
    </div>
  );
};

const getFlashcards = () => {
  const cards  = flashCardService.getFlashCards();

  return cards;
};

export default Flashcards;