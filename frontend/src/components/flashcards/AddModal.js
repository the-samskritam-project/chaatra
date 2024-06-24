import React, { useState } from 'react';

const AddModal = ({ setShowModal }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const handleSave = () => {
    const newFlashcard = { title, body };
    let flashcards = JSON.parse(localStorage.getItem('flashcards')) || [];
    flashcards.push(newFlashcard);
    localStorage.setItem('flashcards', JSON.stringify(flashcards));
    setShowModal(false);
    window.location.reload(); // Refresh the page to show the new flashcard
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  return (
    <div className="add-flashcard-modal">
      <div className="modal-header">
        <h2>New Flashcard</h2>
      </div>
      <div className="modal-body">
        <input 
          type="text" 
          placeholder="Title" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
        />
        <textarea 
          placeholder="Body" 
          value={body} 
          onChange={(e) => setBody(e.target.value)} 
        />
      </div>
      <div className="modal-footer">
        <button className="save-button" onClick={handleSave}>Save</button>
        <button className="cancel-button" onClick={handleCancel}>Cancel</button>
      </div>
    </div>
  );
};

export default AddModal;
