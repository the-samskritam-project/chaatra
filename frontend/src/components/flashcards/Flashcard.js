import React, { useState } from 'react';
import Modal from './Modal'; // Import the Modal component
import { toDevanagiriString } from '../../utils/transliterate';

const Flashcard = ({ flashcard }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div>
      <div onClick={handleOpenModal} className="flashcard-summary">
        <h3>{toDevanagiriString(flashcard.Word)}</h3>
        <div className="tags">
          <span className="tag">{flashcard.Type}</span>
        </div>
      </div>
      {isModalOpen && (
        <Modal onClose={handleCloseModal} flashcard={flashcard} />
      )}
    </div>
  );
};

export default Flashcard;
