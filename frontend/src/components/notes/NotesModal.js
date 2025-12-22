import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import NotesService from '../../services/NotesService';
import './NotesModal.css';

const NotesModal = ({ verse, isOpen, onClose, apiUrl, token }) => {
  const [notes, setNotes] = useState([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const notesService = new NotesService(apiUrl);

  // Fetch existing notes when modal opens
  useEffect(() => {
    if (isOpen && verse && token) {
      fetchNotes();
    } else {
      // Reset state when modal closes
      setNotes([]);
      setNewNoteContent('');
      setError('');
      setSuccess(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, verse?.verse_number, token]);

  const fetchNotes = async () => {
    if (!verse || !verse.verse_number) return;

    setIsLoading(true);
    setError('');

    try {
      const fetchedNotes = await notesService.fetchNotes(
        'bhagavad_gita',
        'Verse',
        verse.verse_number,
        token
      );
      setNotes(Array.isArray(fetchedNotes) ? fetchedNotes : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch notes');
      console.error('Error fetching notes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!newNoteContent.trim()) {
      setError('Please enter a note');
      return;
    }

    if (!verse || !verse.verse_number) {
      setError('Verse information is missing');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess(false);

    try {
      await notesService.createNote(
        'bhagavad_gita',
        'Verse',
        verse.verse_number,
        newNoteContent.trim(),
        token
      );

      setSuccess(true);
      setNewNoteContent('');
      
      // Refresh notes list
      await fetchNotes();

      // Clear success message after 2 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to save note');
      console.error('Error saving note:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving && !isLoading) {
      onClose();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateString;
    }
  };

  const splitDevanagariLines = (text) => {
    if (!text) return [];
    return text.split('\n').filter((line) => line.trim());
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="notes-modal-overlay" onClick={handleClose}>
      <div className="notes-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="notes-modal-close" onClick={handleClose} disabled={isSaving || isLoading}>
          ×
        </button>

        <div className="notes-modal-header">
          <h2>Notes for Verse {verse?.verse_number || ''}</h2>
        </div>

        {/* Verse Context */}
        <div className="notes-verse-context">
          {verse?.transliterated_devanagari && (
            <div className="notes-verse-devanagari">
              {splitDevanagariLines(verse.transliterated_devanagari).map((line, idx) => (
                <div key={`devanagari-${idx}`} className="notes-verse-line">
                  {line}
                </div>
              ))}
            </div>
          )}

          {verse?.full_translation && (
            <div className="notes-verse-translation">
              <div className="notes-verse-label">Translation:</div>
              <div className="notes-verse-translation-text">{verse.full_translation}</div>
            </div>
          )}
        </div>

        {/* Existing Notes */}
        <div className="notes-existing-section">
          <div className="notes-section-title">Your Notes</div>
          {isLoading ? (
            <div className="notes-loading">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="notes-empty">No notes yet. Add your first note below.</div>
          ) : (
            <div className="notes-list">
              {notes.map((note) => (
                <div key={note.id || note._id} className="notes-item">
                  <div className="notes-item-content">{note.content}</div>
                  <div className="notes-item-meta">
                    {formatDate(note.created_at)}
                    {note.updated_at && note.updated_at !== note.created_at && (
                      <span className="notes-item-updated"> (updated {formatDate(note.updated_at)})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New Note Form */}
        <div className="notes-new-section">
          <div className="notes-section-title">Add New Note</div>
          <form onSubmit={handleSave} className="notes-form">
            <textarea
              className="notes-textarea"
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Enter your note here..."
              rows={6}
              disabled={isSaving || isLoading}
            />
            {error && <div className="notes-error">{error}</div>}
            {success && <div className="notes-success">Note saved successfully!</div>}
            <div className="notes-form-actions">
              <button
                type="submit"
                className="notes-save-button"
                disabled={isSaving || isLoading || !newNoteContent.trim()}
              >
                {isSaving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NotesModal;

