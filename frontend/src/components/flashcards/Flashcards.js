import Flashcard from './Flashcard';
import React, { useState, useEffect } from 'react';
import './Flashcards.css'
import AddModal from './AddModal';

const Flashcards = () => {
  const [flashcards, setFlashcards] = useState([]);

  useEffect(() => {
    setFlashcards(getFlashcards());
  }, []);

  const [showModal, setShowModal] = useState(false);

  const handleAddButtonClick = () => {
    setShowModal(true);
  };

  return (
    <div className="flashcards-container">
      <div className="flashcards-header">
        <button className="flashcard-add-button" onClick={handleAddButtonClick}>
          Add
        </button>
      </div>
      <div className="flashcards-list">
        {flashcards.map((flashcard, index) => (
          <Flashcard key={index} flashcard={flashcard} />
        ))}
      </div>
      {showModal && <AddModal setShowModal={setShowModal} />}
    </div>
  );
};

const getFlashcards = () => {
  const flashcards = JSON.parse(localStorage.getItem('flashcards')) || [];
  return flashcards;
};

export default Flashcards;