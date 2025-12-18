import React, { useState, useEffect, useRef } from 'react';
import CorpusViewer from '../corpus/CorpusViewer';
import './Pancatantra.css';

function Pancatantra() {
  const [apiUrl, setApiUrl] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const modalRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    const url = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
    setApiUrl(url);
  }, []);

  // Debounced search for dropdown suggestions
  useEffect(() => {
    if (!apiUrl || !query.trim()) {
      setSuggestions([]);
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce API calls
    debounceTimerRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch(
          `${apiUrl}/v2/search/semantic?q=${encodeURIComponent(query)}&limit=10&corpus=pancatantra`
        );

        if (!response.ok) {
          throw new Error(`Request failed: ${response.statusText}`);
        }

        const data = await response.json();
        setSuggestions(data);
      } catch (err) {
        console.error('Thematic search error:', err);
        setError('Unable to fetch suggestions. Please try again.');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, apiUrl]);

  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target)
      ) {
        handleCloseModal();
      }
    };

    if (showSearchModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSearchModal]);

  // Handle keyboard navigation and Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showSearchModal) return;

      if (e.key === 'Escape') {
        handleCloseModal();
        return;
      }

      if (suggestions.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        handleSuggestionClick(suggestions[selectedIndex]);
      }
    };

    if (showSearchModal) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showSearchModal, suggestions, selectedIndex]);

  // Focus input when modal opens
  useEffect(() => {
    if (showSearchModal && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showSearchModal]);

  const handleOpenModal = () => {
    setShowSearchModal(true);
    setQuery('');
    setSuggestions([]);
    setSelectedIndex(-1);
    setError('');
  };

  const handleCloseModal = () => {
    setShowSearchModal(false);
    setQuery('');
    setSuggestions([]);
    setSelectedIndex(-1);
    setError('');
  };

  const handleSuggestionClick = (suggestion) => {
    // For now, nothing happens as per user requirement
    console.log('Selected suggestion:', suggestion);
  };

  const getItemIdentifier = (item) => {
    return item.verse_number || item.prose_number || '';
  };

  const getItemType = (item) => {
    return item.type || (item.verse_number ? 'verse' : 'prose');
  };

  const getCorpusDisplayName = (corpusName) => {
    if (!corpusName) return '';
    return corpusName.charAt(0).toUpperCase() + corpusName.slice(1);
  };

  return (
    <div>
      <CorpusViewer 
        corpusName="pancatantra" 
        showSearchIcon={true}
        onSearchClick={handleOpenModal}
      />
      
      {showSearchModal && (
        <div className="pancatantra-search-modal-overlay">
          <div 
            className={`pancatantra-search-modal ${suggestions.length > 0 ? 'has-results' : ''}`} 
            ref={modalRef}
          >
            <div className="pancatantra-search-modal-header">
              <div className="pancatantra-search-input-container">
                <input
                  ref={inputRef}
                  type="text"
                  className="pancatantra-search-input"
                  placeholder="Search by theme (e.g., friendship, wisdom, courage)..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(-1);
                  }}
                />
                {isLoading && (
                  <div className="pancatantra-search-loading">Searching...</div>
                )}
              </div>
              <button
                className="pancatantra-search-close-button"
                onClick={handleCloseModal}
                aria-label="Close search"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="pancatantra-search-error">{error}</div>
            )}

            <div className="pancatantra-search-modal-content">
              {suggestions.length > 0 && (
                <div className="pancatantra-search-results">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion.corpus_name}-${getItemIdentifier(suggestion)}-${index}`}
                      className={`pancatantra-search-result-item ${
                        index === selectedIndex ? 'selected' : ''
                      }`}
                      onClick={() => handleSuggestionClick(suggestion)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="pancatantra-search-item-header">
                        <span className="pancatantra-search-corpus">
                          {getCorpusDisplayName(suggestion.corpus_name)}
                        </span>
                        <span className="pancatantra-search-item-id">
                          {getItemType(suggestion).charAt(0).toUpperCase() +
                            getItemType(suggestion).slice(1)}{' '}
                          {getItemIdentifier(suggestion)}
                        </span>
                        {suggestion.chapter_number !== undefined && (
                          <span className="pancatantra-search-chapter">
                            Chapter {suggestion.chapter_number}
                          </span>
                        )}
                        {suggestion.score && (
                          <span className="pancatantra-search-score">
                            {(suggestion.score * 100).toFixed(1)}% match
                          </span>
                        )}
                      </div>
                      {suggestion.transliterated_devanagari && (
                        <div className="pancatantra-search-devanagari">
                          {suggestion.transliterated_devanagari}
                        </div>
                      )}
                      {suggestion.original_iast && (
                        <div className="pancatantra-search-iast">
                          {suggestion.original_iast}
                        </div>
                      )}
                      {suggestion.full_translation && (
                        <div className="pancatantra-search-translation">
                          {suggestion.full_translation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!query.trim() && (
                <div className="pancatantra-search-empty">
                  <p>Enter a theme to find relevant verses and prose from Pancatantra.</p>
                </div>
              )}
              {query.trim() && !isLoading && suggestions.length === 0 && (
                <div className="pancatantra-search-empty">
                  <p>No results found. Try a different search term.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Pancatantra;
