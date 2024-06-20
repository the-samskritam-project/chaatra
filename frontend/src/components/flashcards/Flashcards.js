import Flashcard from './Flashcard';
import React, { useState, useEffect} from 'react';

const Flashcards = () => {
  const [flashcards, setFlashcards] = useState([]);

  useEffect(() => {
    setFlashcards(getFlashcards());
  }, []);

  return (
    <div className="flashcards-list">
      {flashcards.map((flashcard, index) => (
        <Flashcard key={index} flashcard={flashcard} />
      ))}
    </div>
  );
};

const getFlashcards = () => {
  const flashcards = JSON.parse(localStorage.getItem('flashcards')) || [];
  return flashcards;
};

export default Flashcards;