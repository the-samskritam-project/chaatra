import React, { useEffect, useRef } from 'react';
import { splitShlokaLines } from './shlokaUtils';
import './Ramayana.css';

const RamayanaModal = ({
  isOpen,
  onClose,
  contextData,
  isLoading,
  error,
  onSummarize,
  isSummaryLoading,
  summary,
  summaryError,
  disableSummarize,
}) => {
  const selectedRef = useRef(null);

  const formatSummaryText = (text) => {
    if (!text) return null;
    const parts = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${key++}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      parts.push(<strong key={`bold-${key++}`}>{match[1]}</strong>);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`text-${key++}`}>{text.slice(lastIndex)}</span>);
    }

    return parts;
  };

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [contextData]);

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
            className={`ramayana-modal-context-entry ${
              item.kanda === contextData.kanda &&
              item.sarga === contextData.sarga &&
              item.shloka === contextData.shloka
                ? 'ramayana-context-selected'
                : ''
            }`}
            ref={
              item.kanda === contextData.kanda &&
              item.sarga === contextData.sarga &&
              item.shloka === contextData.shloka
                ? selectedRef
                : null
            }
          >
            <div className="ramayana-modal-context-heading">
              <span className="ramayana-kanda">{item.kanda}</span>
              <span className="ramayana-sarga">Sarga {item.sarga} • Shloka {item.shloka}</span>
            </div>
            <div className="ramayana-modal-shloka">
              {splitShlokaLines(item.shloka_text).map((line, idx) => (
                <span key={`${item.shloka}-${idx}`} className="shloka-line">
                  {line}
                </span>
              ))}
            </div>
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

  const showSummaryPanel = isSummaryLoading || summary || summaryError;

  return (
    <div className="ramayana-modal-overlay" onClick={onClose}>
      <div className="ramayana-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ramayana-modal-header">
          <div className="ramayana-modal-actions">
            <button
              className="search-button ramayana-summarize-button"
              onClick={onSummarize}
              disabled={disableSummarize || isSummaryLoading}
            >
              {isSummaryLoading ? 'Summarising...' : 'Summarise'}
            </button>
            <button className="ramayana-modal-close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className={`ramayana-modal-body ${showSummaryPanel ? 'with-summary' : ''}`}>
          <div className="ramayana-context-panel">{renderContext()}</div>
          {showSummaryPanel && (
            <div className="ramayana-summary-panel">
              <div className="ramayana-summary-card">
                <h3>Summary</h3>
                {isSummaryLoading && (
                  <p className="ramayana-modal-loading small">Generating summary...</p>
                )}
                {summaryError && <p className="ramayana-modal-error">{summaryError}</p>}
                {!isSummaryLoading && !summaryError && summary && (
                  <p className="ramayana-summary-text">{formatSummaryText(summary)}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RamayanaModal;

