import React from 'react';
import './Modal.css'; // Ensure you create and style the modal in this CSS file

const Modal = ({ onClose, children }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button onClick={onClose} className="close-button">X</button>
        {children}
      </div>
    </div>
  );
};

export default Modal;
