import React, { useState, useEffect, useRef } from 'react';
import './ThematicSearch.css';

function ThematicSearch() {
  const [apiUrl, setApiUrl] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef(null);
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
      setShowDropdown(false);
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
          `${apiUrl}/v2/search/semantic?q=${encodeURIComponent(query)}&limit=10`
        );

        if (!response.ok) {
          throw new Error(`Request failed: ${response.statusText}`);
        }

        const data = await response.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch (err) {
        console.error('Thematic search error:', err);
        setError('Unable to fetch suggestions. Please try again.');
        setSuggestions([]);
        setShowDropdown(false);
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

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showDropdown || suggestions.length === 0) return;

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
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    if (showDropdown) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showDropdown, suggestions, selectedIndex]);

  const handleSuggestionClick = (suggestion) => {
    setShowDropdown(false);
    setSelectedIndex(-1);
    // You can add navigation or modal display here
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
    <div className="thematic-search-container">
      <div className="thematic-search-wrapper">
        <div className="thematic-search-input-container" ref={dropdownRef}>
          <input
            ref={inputRef}
            type="text"
            className="thematic-search-input"
            placeholder="Search by theme (e.g., friendship, wisdom, courage)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowDropdown(true);
              }
            }}
          />
          {isLoading && (
            <div className="thematic-search-loading">Searching...</div>
          )}
          {showDropdown && suggestions.length > 0 && (
            <div className="thematic-search-dropdown">
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.corpus_name}-${getItemIdentifier(suggestion)}-${index}`}
                  className={`thematic-search-dropdown-item ${
                    index === selectedIndex ? 'selected' : ''
                  }`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="thematic-search-item-header">
                    <span className="thematic-search-corpus">
                      {getCorpusDisplayName(suggestion.corpus_name)}
                    </span>
                    <span className="thematic-search-item-id">
                      {getItemType(suggestion).charAt(0).toUpperCase() +
                        getItemType(suggestion).slice(1)}{' '}
                      {getItemIdentifier(suggestion)}
                    </span>
                    {suggestion.chapter_number !== undefined && (
                      <span className="thematic-search-chapter">
                        Chapter {suggestion.chapter_number}
                      </span>
                    )}
                    {suggestion.score && (
                      <span className="thematic-search-score">
                        {(suggestion.score * 100).toFixed(1)}% match
                      </span>
                    )}
                  </div>
                  {suggestion.transliterated_devanagari && (
                    <div className="thematic-search-devanagari">
                      {suggestion.transliterated_devanagari}
                    </div>
                  )}
                  {suggestion.original_iast && (
                    <div className="thematic-search-iast">
                      {suggestion.original_iast}
                    </div>
                  )}
                  {suggestion.full_translation && (
                    <div className="thematic-search-translation">
                      {suggestion.full_translation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div className="thematic-search-error">{error}</div>}

        {!query.trim() && (
          <div className="thematic-search-empty-state">
            <p>Enter a theme to find relevant verses and prose from Hitopadesa and Pancatantra.</p>
            <p className="thematic-search-hint">
              Try searching for themes like: friendship, wisdom, courage, loyalty, or any concept you're interested in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ThematicSearch;
