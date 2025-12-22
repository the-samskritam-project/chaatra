import React, { useState, useEffect } from 'react';
import '../hitopadesa/Hitopadesa.css';

function CorpusVerse({ verse, apiUrl, corpusName, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitError, setSplitError] = useState('');
  const [splitResult, setSplitResult] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [localTranslation, setLocalTranslation] = useState(null);
  const [isAITranslated, setIsAITranslated] = useState(false);

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
    // Use local translation if available (just generated), otherwise use verse data
    const translationText = localTranslation || verse.full_translation;
    
    if (verse.edited_translations && verse.edited_translations.length > 0) {
      const lastEdit = verse.edited_translations[verse.edited_translations.length - 1];
      return {
        text: lastEdit.translation,
        isEdited: true,
        editedAt: lastEdit.edited_at
      };
    }
    return {
      text: translationText,
      isEdited: false,
      editedAt: null
    };
  };

  // Recompute display translation on every render to pick up localTranslation changes
  const displayTranslation = getDisplayTranslation();
  
  // Debug: log when translation should be visible
  useEffect(() => {
    console.log('Display translation check:', {
      hasLocalTranslation: !!localTranslation,
      hasVerseTranslation: !!verse.full_translation,
      hasAITranslatedAt: !!verse.ai_translated_at,
      isAITranslated: isAITranslated,
      displayText: displayTranslation.text,
      displayTextLength: displayTranslation.text?.length || 0,
      isEdited: displayTranslation.isEdited,
      shouldShowLabel: !!(verse.ai_translated_at || isAITranslated) && !displayTranslation.isEdited,
      shouldShow: !!(displayTranslation.text || isEditing || localTranslation)
    });
  }, [localTranslation, verse.full_translation, verse.ai_translated_at, isAITranslated, displayTranslation.text, displayTranslation.isEdited, isEditing]);

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

  const handleSplit = async () => {
    if (!verse.verse_number) {
      setSplitError('Verse number is required');
      return;
    }

    setIsSplitting(true);
    setSplitError('');

    try {
      const response = await fetch(`${apiUrl}/v2/bhagavad_gita/verses/${verse.verse_number}/split`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to split verse');
      }

      const data = await response.json();
      setSplitResult({
        uncompounded_shloka: data.uncompounded_shloka,
        word_by_word_translation: data.word_by_word_translation || []
      });

      // Call parent callback to refresh verses (to get updated data from server)
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Error splitting verse:', err);
      setSplitError(err.message || 'Failed to split verse. Please try again.');
    } finally {
      setIsSplitting(false);
    }
  };

  // Load existing split results from verse data
  useEffect(() => {
    if (verse.split_shloka) {
      setSplitResult({
        uncompounded_shloka: verse.split_shloka,
        word_by_word_translation: verse.split_word_by_word_translation || []
      });
    }
  }, [verse.split_shloka, verse.split_word_by_word_translation]);

  // Clear local translation when verse prop updates with new translation from server
  useEffect(() => {
    // Only clear if verse has translation from server (after refresh)
    // Don't clear immediately - let it persist until server data arrives
    if (verse.full_translation && localTranslation && verse.full_translation === localTranslation) {
      // Translation matches what we have locally, safe to clear
      setLocalTranslation(null);
      // Keep isAITranslated true if verse has ai_translated_at
      if (!verse.ai_translated_at) {
        setIsAITranslated(false);
      }
    }
    // If verse has ai_translated_at, mark as AI translated
    if (verse.ai_translated_at) {
      setIsAITranslated(true);
    }
  }, [verse.full_translation, verse.ai_translated_at, localTranslation]);

  const handleTranslate = async () => {
    if (!verse.verse_number) {
      setTranslationError('Verse number is required');
      return;
    }

    setIsTranslating(true);
    setTranslationError('');

    try {
      const response = await fetch(`${apiUrl}/v2/bhagavad_gita/verses/${verse.verse_number}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to translate verse');
      }

      const data = await response.json();
      console.log('Translation response:', data);
      console.log('Translation text:', data.translation);
      
      // Update local state immediately with the translation
      if (data.translation && data.translation.trim()) {
        console.log('Setting local translation:', data.translation.substring(0, 100));
        setLocalTranslation(data.translation.trim());
        setIsAITranslated(true); // Mark as AI translated
      } else {
        console.error('No translation in response or translation is empty:', data);
        throw new Error('No translation in response');
      }
      
      // Call parent callback to refresh verses (to get updated data from server)
      // Don't await - let it happen in background, keep local translation visible
      if (onUpdate) {
        // Refresh in background - localTranslation will persist until server data arrives
        onUpdate().catch(err => {
          console.error('Error refreshing verses:', err);
        });
      }
    } catch (err) {
      console.error('Error translating verse:', err);
      setTranslationError(err.message || 'Failed to translate verse. Please try again.');
    } finally {
      setIsTranslating(false);
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
        {corpusName === 'bhagavad_gita' && verse.type === 'original_verse' && (
          <button
            className="hitopadesa-split-button"
            onClick={handleSplit}
            disabled={isSplitting || !!verse.split_shloka}
            type="button"
          >
            {isSplitting ? 'Splitting...' : 'Split'}
          </button>
        )}
        {verse.chapter_sequence_index && (
          <span className="hitopadesa-sequence-number">#{verse.chapter_sequence_index}</span>
        )}
      </div>

      <div className="hitopadesa-verse-content">
        <div className="hitopadesa-verse-column-left">
          {verse.transliterated_devanagari && (() => {
            const lines = splitDevanagariLines(verse.transliterated_devanagari);
            const isGitaVerse = corpusName === 'bhagavad_gita' && verse.type === 'original_verse';
            return (
              <div className={`hitopadesa-devanagari ${isGitaVerse ? 'gita-main-verse' : ''}`}>
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

          {/* Split results display */}
          {(splitResult || verse.split_shloka) && (() => {
            const splitText = splitResult?.uncompounded_shloka || verse.split_shloka || '';
            const splitLines = splitDevanagariLines(splitText);
            return (
              <div className="hitopadesa-split-results">
                <div className="hitopadesa-split-header">Split Shloka (Uncompounded):</div>
                <div className="hitopadesa-split-shloka">
                  {splitLines.map((line, idx) => (
                    <div key={`split-line-${getItemNumber()}-${idx}`} className="hitopadesa-line">
                      {line}
                    </div>
                  ))}
                </div>
                {(splitResult?.word_by_word_translation?.length > 0 || verse.split_word_by_word_translation?.length > 0) && (
                  <div className="hitopadesa-split-word-by-word">
                    <div className="hitopadesa-split-header">Word-by-Word Translation:</div>
                    <div className="hitopadesa-word-list">
                      {(splitResult?.word_by_word_translation || verse.split_word_by_word_translation || []).map((item, idx) => (
                        <span key={`split-word-${getItemNumber()}-${idx}`} className="hitopadesa-word-item">
                          <span className="hitopadesa-word">{item.word}</span>
                          <span className="hitopadesa-word-translation">({item.translation})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {splitError && (
                  <div className="hitopadesa-split-error">{splitError}</div>
                )}
              </div>
            );
          })()}
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

          {/* Translation section with AI translate button */}
          <div className="hitopadesa-translation-section">
            {corpusName === 'bhagavad_gita' && verse.type === 'original_verse' && (
              <button
                className="hitopadesa-translate-button"
                onClick={handleTranslate}
                disabled={isTranslating || !!verse.full_translation}
                type="button"
              >
                {isTranslating ? 'Translating...' : 'Translate'}
              </button>
            )}
            {translationError && (
              <div className="hitopadesa-translation-error">{translationError}</div>
            )}
          </div>

          {(displayTranslation.text || isEditing || localTranslation) && (
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
                  {(verse.ai_translated_at || isAITranslated) && !displayTranslation.isEdited && (
                    <span className="hitopadesa-ai-translated-label">Translated with AI</span>
                  )}
                  {displayTranslation.isEdited && (
                    <span className="hitopadesa-edited-label">Edited</span>
                  )}
                  <p 
                    className="hitopadesa-translation-text hitopadesa-translation-clickable"
                    onClick={handleEditClick}
                    title="Click to edit"
                  >
                    {displayTranslation.text || localTranslation || 'No translation available'}
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

