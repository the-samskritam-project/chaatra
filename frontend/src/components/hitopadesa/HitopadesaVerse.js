import React, { useState, useEffect } from 'react';
import './Hitopadesa.css';

function HitopadesaVerse({ verse, apiUrl, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const splitDevanagariLines = (text) => {
    if (!text) return [];
    return text.split('\n').filter((line) => line.trim());
  };

  // Get the translation to display
  const getDisplayTranslation = () => {
    if (verse.edited_translations && verse.edited_translations.length > 0) {
      const lastEdit = verse.edited_translations[verse.edited_translations.length - 1];
      return {
        text: lastEdit.translation,
        isEdited: true,
        editedAt: lastEdit.edited_at
      };
    }
    return {
      text: verse.full_translation,
      isEdited: false,
      editedAt: null
    };
  };

  const displayTranslation = getDisplayTranslation();

  // Initialize edit value when entering edit mode
  useEffect(() => {
    if (isEditing) {
      const currentTranslation = getDisplayTranslation();
      setEditValue(currentTranslation.text || '');
      setError('');
    }
  }, [isEditing, verse.edited_translations, verse.full_translation]);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
    setError('');
  };

  const handleSave = async () => {
    if (!editValue.trim()) {
      setError('Translation cannot be empty');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const itemNumber = getItemNumber();
      const response = await fetch(`${apiUrl}/v2/hitopadesa/verses/${itemNumber}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          edited_translation: editValue.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to save translation');
      }

      // Call parent callback to refresh verses
      if (onUpdate) {
        onUpdate();
      }

      setIsEditing(false);
    } catch (err) {
      console.error('Error saving translation:', err);
      setError(err.message || 'Failed to save translation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Get the item number (verse_number or prose_number)
  const getItemNumber = () => {
    return verse.verse_number || verse.prose_number || '';
  };

  // Get the type label
  const getTypeLabel = () => {
    const type = verse.type || (verse.verse_number ? 'verse' : 'prose');
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Debug logging
  useEffect(() => {
    console.log('Rendering HitopadesaVerse:', {
      type: verse.type,
      verse_number: verse.verse_number,
      prose_number: verse.prose_number,
      chapter_sequence_index: verse.chapter_sequence_index
    });
  }, [verse]);

  return (
    <div className="hitopadesa-verse">
      <div className="hitopadesa-verse-header">
        <span className="hitopadesa-verse-type">{getTypeLabel()}</span>
        <span className="hitopadesa-verse-id">{getItemNumber()}</span>
        {verse.chapter_sequence_index && (
          <span className="hitopadesa-sequence-number">#{verse.chapter_sequence_index}</span>
        )}
      </div>

      <div className="hitopadesa-verse-content">
        <div className="hitopadesa-verse-column-left">
          {verse.transliterated_devanagari && (
            <div className="hitopadesa-devanagari">
              {splitDevanagariLines(verse.transliterated_devanagari).map((line, idx) => (
                <div key={`devanagari-${getItemNumber()}-${idx}`} className="hitopadesa-line">
                  {line}
                </div>
              ))}
            </div>
          )}

          {verse.original_iast && (
            <div className="hitopadesa-iast">{verse.original_iast}</div>
          )}
        </div>

        <div className="hitopadesa-verse-column-right">
          {verse.word_by_word_translation && verse.word_by_word_translation.length > 0 && (
            <div className="hitopadesa-word-by-word">
              <div className="hitopadesa-word-list">
                {verse.word_by_word_translation.map((item, idx) => (
                  <span key={`word-${getItemNumber()}-${idx}`} className="hitopadesa-word-item">
                    <span className="hitopadesa-word">{item.word}</span>
                    <span className="hitopadesa-word-translation">({item.translation})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {(displayTranslation.text || isEditing) && (
            <div className="hitopadesa-translation">
              {isEditing ? (
                <div className="hitopadesa-translation-edit">
                  <textarea
                    className="hitopadesa-translation-textarea"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={4}
                    disabled={isSaving}
                  />
                  {error && <div className="hitopadesa-translation-error">{error}</div>}
                  <div className="hitopadesa-translation-actions">
                    <button
                      className="hitopadesa-save-button"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="hitopadesa-cancel-button"
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {displayTranslation.isEdited && (
                    <span className="hitopadesa-edited-label">Edited</span>
                  )}
                  <p 
                    className="hitopadesa-translation-text hitopadesa-translation-clickable"
                    onClick={handleEditClick}
                    title="Click to edit"
                  >
                    {displayTranslation.text}
                  </p>
                  {displayTranslation.isEdited && displayTranslation.editedAt && (
                    <div className="hitopadesa-edited-date">
                      Last edited: {formatDate(displayTranslation.editedAt)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HitopadesaVerse;

