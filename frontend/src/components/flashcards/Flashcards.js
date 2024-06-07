import React from 'react';
import Flashcard from './Flashcard';

const Flashcards = ({ flashcards }) => {
  return (
    <div className="flashcards-list">
      {flashcards.map((flashcard, index) => (
        <Flashcard key={index} flashcard={flashcard} />
      ))}
    </div>
  );
};

export default Flashcards;