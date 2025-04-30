import React, { useState } from 'react';
import FlashCardService from '../../services/FlashCardService';

const AddModal = ({ setShowModal, handleAddCard}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    const card = {
      title,
      description,
      front,
      back,
      tags
    };
    handleAddCard(card);
    setShowModal(false);
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
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            placeholder="Enter title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <input
            type="text"
            placeholder="Enter description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Front</label>
          <textarea
            placeholder="Enter front content"
            value={front}
            onChange={(e) => setFront(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Back</label>
          <textarea
            placeholder="Enter back content"
            value={back}
            onChange={(e) => setBack(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Tags</label>
          <div className="tags-input">
            <input
              type="text"
              placeholder="Type and press Enter to add tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
            />
            <div className="tags-list">
              {tags.map((tag, index) => (
                <span key={index} className="tag">
                  {tag}
                  <button 
                    className="tag-remove"
                    onClick={() => removeTag(tag)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="save-button" onClick={handleSave}>Save</button>
        <button className="cancel-button" onClick={handleCancel}>Cancel</button>
      </div>
    </div>
  );
};

export default AddModal;
