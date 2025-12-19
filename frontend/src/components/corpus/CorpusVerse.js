import React, { useState, useEffect } from 'react';
import '../hitopadesa/Hitopadesa.css';

function CorpusVerse({ verse, apiUrl, corpusName, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const splitDevanagariLines = (text) => {
    if (!text) return [];
    
    // Get verse type to determine if this is a verse or commentary
    const verseType = verse.type || (verse.verse_number ? 'verse' : 'prose');
    const isVerse = verseType === 'original_verse' || verseType === 'verse';
    
    // For Bhagavad Gita, split verses (not commentary) on | or Devanagari danda (।, ॥) to create two-line display
    if (corpusName === 'bhagavad_gita' && isVerse) {
      // First, check if text already has newlines (might be split already)
      const hasNewlines = text.includes('\n');
      const hasPipe = text.includes('|');
      const hasDanda = text.includes('।') || text.includes('॥');
      
      if (hasNewlines) {
        // Text is already split by newlines - clean each line and return
        const lines = text.split('\n')
          .map(p => p.replace(/\|\|?$/, '').replace(/^\|/, '').replace(/[।॥]+$/, '').trim())
          .filter(p => p && p.length > 0);
        return lines.length > 0 ? lines : [text.trim()];
      }
      
      // Try splitting on Devanagari danda first (। or ॥)
      if (hasDanda) {
        // Replace any newlines with spaces
        let cleanText = text.replace(/\n/g, ' ');
        // Split on single danda (।) and keep the danda with the first part
        // Pattern: "text। text॥" should become ["text।", "text॥"]
        const parts = cleanText.split(/(।)/);
        const result = [];
        let current = '';
        
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === '।') {
            // Found a danda - add it to current and push as a line
            current += '।';
            if (current.trim()) {
              result.push(current.trim());
              current = '';
            }
          } else if (parts[i].trim()) {
            current += parts[i];
          }
        }
        
        // Add remaining text (which may have ॥ at the end)
        if (current.trim()) {
          result.push(current.trim());
        }
        
        // Return if we got at least 2 parts
        if (result.length >= 2) {
          return result;
        }
      }
      
      // Try splitting on pipe character
      if (hasPipe) {
        // Remove trailing || if present
        let cleanText = text.replace(/\|\|$/, '').trim();
        // Replace any newlines with spaces
        cleanText = cleanText.replace(/\n/g, ' ');
        // Split on | separator
        const parts = cleanText.split('|')
          .map(p => p.trim())
          .filter(p => p && p.length > 0);
        
        // Return parts if we have at least 2, otherwise return as single line
        if (parts.length >= 2) {
          return parts;
        }
      }
      
      // Fallback: return as single line (remove any trailing punctuation)
      return [text.replace(/[।॥]+$/, '').replace(/\|\|?$/, '').trim()];
    }
    
    // For commentary or other corpora, split by newlines only (don't split on danda)
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
      const response = await fetch(`${apiUrl}/v2/${corpusName}/verses/${itemNumber}`, {
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
    
    // Handle Bhagavad Gita specific types
    if (type === 'original_verse') {
      return 'Original Verse';
    }
    if (type === 'commentary') {
      return 'Commentary';
    }
    
    // Handle standard types
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Debug logging
  useEffect(() => {
    console.log('Rendering CorpusVerse:', {
      type: verse.type,
      verse_number: verse.verse_number,
      prose_number: verse.prose_number,
      chapter_sequence_index: verse.chapter_sequence_index
    });
  }, [verse]);

  // Get background class based on type
  const getBackgroundClass = () => {
    const type = verse.type || (verse.verse_number ? 'verse' : 'prose');
    if (type === 'original_verse') {
      return 'hitopadesa-verse-original';
    }
    if (type === 'commentary') {
      return 'hitopadesa-verse-commentary';
    }
    return '';
  };

  const backgroundClass = getBackgroundClass();
  const verseClassName = backgroundClass 
    ? `hitopadesa-verse ${backgroundClass}`
    : 'hitopadesa-verse';

  return (
    <div className={verseClassName}>
      <div className="hitopadesa-verse-header">
        {corpusName !== 'bhagavad_gita' && (
          <span className="hitopadesa-verse-type">{getTypeLabel()}</span>
        )}
        <span className="hitopadesa-verse-id">{getItemNumber()}</span>
        {verse.chapter_sequence_index && (
          <span className="hitopadesa-sequence-number">#{verse.chapter_sequence_index}</span>
        )}
      </div>

      <div className="hitopadesa-verse-content">
        <div className="hitopadesa-verse-column-left">
          {verse.transliterated_devanagari && (() => {
            const lines = splitDevanagariLines(verse.transliterated_devanagari);
            return (
              <div className="hitopadesa-devanagari">
                {lines.map((line, idx) => (
                  <div key={`devanagari-${getItemNumber()}-${idx}`} className="hitopadesa-line">
                    {line}
                  </div>
                ))}
              </div>
            );
          })()}

          {corpusName !== 'bhagavad_gita' && verse.original_iast && (
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

export default CorpusVerse;

