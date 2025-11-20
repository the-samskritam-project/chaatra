import React from 'react';
import './Ramayana.css';

const RamayanaModal = ({ isOpen, onClose, entry, contextData, isLoading, error }) => {
  if (!isOpen) return null;

  const renderContext = () => {
    if (isLoading) {
      return <div className="ramayana-modal-loading">Loading context...</div>;
    }

    if (error) {
      return <div className="ramayana-modal-error">{error}</div>;
    }

    if (!contextData || !contextData.entries || contextData.entries.length === 0) {
      return <div className="ramayana-modal-empty">No context available.</div>;
    }

    return (
      <div className="ramayana-modal-context">
        {contextData.entries.map((item) => (
          <div
            key={`${item.kanda}-${item.sarga}-${item.shloka}`}
            className="ramayana-modal-context-entry"
          >
            <div className="ramayana-modal-context-heading">
              <span className="ramayana-kanda">{item.kanda}</span>
              <span className="ramayana-sarga">Sarga {item.sarga} • Shloka {item.shloka}</span>
            </div>
            <div className="ramayana-modal-shloka">{item.shloka_text}</div>
            {item.translation && (
              <div className="ramayana-modal-section">
                <span className="label">Translation</span>
                <p>{item.translation}</p>
              </div>
            )}
            {item.explanation && (
              <div className="ramayana-modal-section">
                <span className="label">Explanation</span>
                <p>{item.explanation}</p>
              </div>
            )}
            {item.comments && (
              <div className="ramayana-modal-section">
                <span className="label">Comments</span>
                <p>{item.comments}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="ramayana-modal-overlay" onClick={onClose}>
      <div className="ramayana-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ramayana-modal-header">
          <h2>Context Window</h2>
          <button className="ramayana-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        {renderContext()}
      </div>
    </div>
  );
};

export default RamayanaModal;

