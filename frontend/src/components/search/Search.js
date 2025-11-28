import React, { useState, useEffect, useRef } from 'react';
import './Search.css';
import { toDevanagiriString } from '../../utils/transliterate'; // add this

function SearchBar({ devanagariString, slp1LatinStr, onInputChange, onFocus, handleBlur, handleSearch, keyboardType, onKeyboardTypeChange, onDropdownItemClick, apiUrl, onClear, onDropdownItemSelected }) {
    const [dropdownResults, setDropdownResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    // Debounce timer for API calls
    const debounceTimerRef = useRef(null);

    useEffect(() => {
        if (!apiUrl) return;

        const query = keyboardType === 'qwerty' ? devanagariString.trim() : slp1LatinStr.trim();
        if (!query) {
            setDropdownResults([]);
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
            try {
                if (keyboardType === 'devanagari') {
                    const [completeResponse, searchResponse] = await Promise.all([
                        fetch(`${apiUrl}/complete?slp1=${encodeURIComponent(query)}`).catch(() => null),
                    ]);

                    const completeResults = completeResponse && completeResponse.ok 
                        ? await completeResponse.json() 
                        : [];
                    const searchResults = searchResponse && searchResponse.ok 
                        ? await searchResponse.json() 
                        : [];

                    // Combine results: first 5 from complete, then 5 from search
                    const combined = [
                        ...completeResults.slice(0, 5).map(word => ({ 
                            type: 'complete', 
                            devanagariWord: word,
                            slp1Query: query // Store the query for /search call
                        })),
                        ...searchResults.slice(0, 5).map(entry => ({ 
                            type: 'search', 
                            ...entry 
                        }))
                    ];

                    setDropdownResults(combined);
                    setShowDropdown(combined.length > 0);
                } else {
                    // English mode: Call only /v2/search/english
                    const searchResponse = await fetch(`${apiUrl}/v2/search/english?q=${encodeURIComponent(query)}&n=5`);
                    if (searchResponse.ok) {
                        const searchResults = await searchResponse.json();
                        const combined = searchResults.slice(0, 5).map(entry => ({ 
                            type: 'search', 
                            ...entry 
                        }));
                        setDropdownResults(combined);
                        setShowDropdown(combined.length > 0);
                    } else {
                        setDropdownResults([]);
                        setShowDropdown(false);
                    }
                }
            } catch (error) {
                console.error('Dropdown search error:', error);
                setDropdownResults([]);
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
    }, [devanagariString, slp1LatinStr, keyboardType, apiUrl]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && 
                !dropdownRef.current.contains(event.target) &&
                inputRef.current && 
                !inputRef.current.contains(event.target)) {
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

    const handleItemClick = (item) => {
        setShowDropdown(false);
        if (onDropdownItemClick) {
            // For complete items, use the stored query; for search items, use transliteratedWord
            const slp1ToSearch = item.type === 'complete' 
                ? item.slp1Query 
                : (item.transliteratedWord || slp1LatinStr);
            onDropdownItemClick(slp1ToSearch);
        }
        // Notify parent that a dropdown item was selected (for keyboard dismissal)
        if (onDropdownItemSelected) {
            onDropdownItemSelected();
        }
    };

    const handleInputFocus = (e) => {
        if (onFocus) onFocus(e);
        if (dropdownResults.length > 0) {
            setShowDropdown(true);
        }
    };

    const handleInputBlur = (e) => {
        // Delay blur to allow dropdown click
        setTimeout(() => {
            if (handleBlur) handleBlur(e);
        }, 200);
    };

    const handleClearClick = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        setDropdownResults([]);
        setShowDropdown(false);
        if (typeof onClear === 'function') {
            onClear();
        } else {
            if (keyboardType === 'qwerty' && onInputChange) {
                onInputChange({ target: { value: '' } });
            }
            if (handleSearch) {
                handleSearch('', '');
            }
        }
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    const showClearButton = Boolean(devanagariString && devanagariString.trim().length > 0);

    const getDropdownDevanagari = (item) => {
      if (item.devanagariWord) {
        const parts = item.devanagariWord.split(' — ');
        if (parts.length >= 2) {
          return parts[1].trim();
        }
        return parts[0].trim();
      }
      if (item.transliteratedWord) {
        return toDevanagiriString(item.transliteratedWord);
      }
      return '';
    };

    return (
        <div className="search-bar">
            <div className="input-container" ref={dropdownRef}>
                <input
                    ref={inputRef}
                    type="text"
                    className="search-input"
                    placeholder="Search..."
                    value={devanagariString}
                    onChange={onInputChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                />
                {showClearButton && (
                    <button
                        type="button"
                        className="clear-button"
                        onClick={handleClearClick}
                        aria-label="Clear search"
                    >
                        &times;
                    </button>
                )}
                <div className="keyboard-toggle">
                    <button 
                        className={`keyboard-type-btn ${keyboardType === 'devanagari' ? 'active' : ''}`}
                        onClick={() => onKeyboardTypeChange('devanagari')}
                        title="Devanagari Keyboard"
                    >
                        <span className="devanagari-icon">देव</span>
                    </button>
                    <button 
                        className={`keyboard-type-btn ${keyboardType === 'qwerty' ? 'active' : ''}`}
                        onClick={() => onKeyboardTypeChange('qwerty')}
                        title="QWERTY Keyboard"
                    >
                        <span className="qwerty-icon">ABC</span>
                    </button>
                </div>
                {showDropdown && dropdownResults.length > 0 && (
                    <div className="search-dropdown">
                        {isLoading && <div className="dropdown-loading">Loading...</div>}
                        {dropdownResults.map((item, index) => {
                            const devanagari = item.type === 'complete'
                                ? item.devanagariWord
                                : getDropdownDevanagari(item);

                            return (
                                <div
                                    key={index}
                                    className={`dropdown-item ${item.type === 'complete' ? 'complete-item' : 'search-item'}`}
                                    onClick={() => handleItemClick(item)}
                                >
                                    <span className="dropdown-devanagari">{devanagari}</span>
                                    {item.type === 'search' && item.englishMeaning && (
                                        <>
                                            <span className="dropdown-separator"> - </span>
                                            <span className="dropdown-meaning">{item.englishMeaning}</span>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <button className="search-button" onClick={() => {handleSearch(slp1LatinStr, devanagariString)}}>Search</button>
        </div>
    );
}

export default SearchBar;
