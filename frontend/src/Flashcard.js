import React, { useState } from 'react';
import Modal from './Modal'; // Import the Modal component

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
        <h3>{flashcard.title}</h3>
        <div className="tags">
          {flashcard.tags.map((tag, index) => (
            <span key={index} className="tag">{tag}</span>
          ))}
        </div>
      </div>
      {isModalOpen && (
        <Modal onClose={handleCloseModal}>
          <h2>{flashcard.title}</h2>
          <p>{flashcard.content}</p>
          <div className="tags">
            {flashcard.tags.map((tag, index) => (
              <span key={index} className="tag">{tag}</span>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Flashcard;