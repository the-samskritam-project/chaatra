import React, { useState } from 'react';
import FlashCardService from '../../services/FlashCardService';

const AddModal = ({ setShowModal }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const flashCardService = new FlashCardService();

  const handleSave = () => {
    const tags = [];
    const newBody = [...body];
    flashCardService.createFlashCard({ title, newBody, tags });
    setShowModal(false);
    window.location.reload();
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
