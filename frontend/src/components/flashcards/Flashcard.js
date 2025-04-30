import React, { useState } from 'react';
import Modal from './Modal'; // Import the Modal component
import { toDevanagiriString } from '../../utils/transliterate';

const Flashcard = ({ flashcard, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(flashcard.title); 
  };

  return (
    <div>
      <div onClick={handleOpenModal} className="flashcard-summary">
        <h3>{flashcard.title}</h3>
        <div className="tags">
          {flashcard.tags.map((tag, index) => (
            tag ? <span key={index} className="tag">{tag}</span> : null
          ))}
        </div>
        <button onClick={handleDelete} className="delete-button">Delete</button>
      </div>
      {isModalOpen && (
        <Modal onClose={handleCloseModal} flashcard={flashcard} />
      )}
    </div>
  );
};

export default Flashcard;
