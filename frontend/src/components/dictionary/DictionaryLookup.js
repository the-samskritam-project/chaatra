import React, { useEffect, useState, useRef } from 'react';
import Entries from './Entries';
import KeyboardBridge from '../keyboard/KeyboardBridge';
import SearchBar from '../search/Search';
import { toDevanagiriString } from '../../utils/transliterate';
import './DictionaryLookup.css';

function DictionaryLookup({ apiUrl, isOpen: externalIsOpen, onToggle, onClose }) {
    // Internal state management
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [slp1SearchStr, setSlp1SearchStr] = useState('');
    const [devSearchStr, setDevSearchStr] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [entries, setEntries] = useState([]);
    const [keyboardType, setKeyboardType] = useState('devanagari');
    const [highlightedEntryWord, setHighlightedEntryWord] = useState(null);
    const keyboardRef = useRef(null);

    // Use external isOpen if provided, otherwise use internal state
    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

    // Handle toggle
    const handleToggle = () => {
        const newState = !isOpen;
        if (externalIsOpen === undefined) {
            setInternalIsOpen(newState);
        }
        if (onToggle) {
            onToggle(newState);
        }
        if (!newState && onClose) {
            onClose();
        }
    };

    const handleSearch = (slp1Str, devanagariStr) => {
        setSlp1SearchStr(slp1Str);
        setDevSearchStr(devanagariStr);
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    const handleInput = ({ type, value }) => {
        if (type === 'enter') {
            handleSearch(slp1SearchStr, devSearchStr);
        } else if (type === 'backspace') {
            setSlp1SearchStr(value);
            setDevSearchStr(toDevanagiriString(value));
        } else if (type === 'key') {
            setSlp1SearchStr(value);
            setDevSearchStr(toDevanagiriString(value));
        }
    };

    const handleDirectInput = (e) => {
        const value = e.target.value;
        setSlp1SearchStr(value);
        setDevSearchStr(value);
    };

    const handleClearInput = () => {
        setSlp1SearchStr('');
        setDevSearchStr('');
        setEntries([]);
        setHighlightedEntryWord(null);
    };

    const handleDropdownItemSelected = () => {
        // Dismiss keyboard when a dropdown item is clicked
        if (keyboardRef.current) {
            keyboardRef.current.dismiss();
        }
    };

    // Handle dropdown item click - call /search endpoint
    const handleDropdownItemClick = async (slp1Query, selectedDevanagari = null) => {
        if (!apiUrl || !slp1Query) return;

        try {
            const url = `${apiUrl}/search?slp1=${encodeURIComponent(slp1Query)}`;
            const response = await fetch(url);
            if (response.ok) {
                let data = await response.json();
                
                // If a Devanagari suggestion was selected, find and reorder the matching entry
                if (selectedDevanagari && data.length > 0) {
                    // Extract just the word part if suggestion contains " — "
                    const targetDevanagari = selectedDevanagari.split(' — ')[0].trim();
                    
                    // Find the index of the entry that matches the selected Devanagari
                    const matchingIndex = data.findIndex(entry => {
                        const word = entry.word || entry.Word || '';
                        const entryDevanagari = toDevanagiriString(word);
                        return entryDevanagari === targetDevanagari;
                    });
                    
                    if (matchingIndex !== -1) {
                        // Move the matching entry to the beginning
                        const matchingEntry = data[matchingIndex];
                        data = [matchingEntry, ...data.filter((_, index) => index !== matchingIndex)];
                        // Set the highlighted word (using SLP1 word as identifier)
                        setHighlightedEntryWord(matchingEntry.word || matchingEntry.Word);
                    } else {
                        // No match found, clear highlight
                        setHighlightedEntryWord(null);
                    }
                } else {
                    // No selection, clear highlight
                    setHighlightedEntryWord(null);
                }
                
                setEntries(data);
            } else {
                console.error('Search error:', response.statusText);
                setEntries([]);
                setHighlightedEntryWord(null);
            }
        } catch (error) {
            console.error('Search error:', error);
            setEntries([]);
            setHighlightedEntryWord(null);
        }
    };

    // Get API URL from props or env
    const effectiveApiUrl = apiUrl || process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';

    return (
        <>
            {/* Toggle Button - always visible on right edge */}
            <button 
                className={`dictionary-lookup-toggle ${isOpen ? 'open' : ''}`}
                onClick={handleToggle}
                aria-label={isOpen ? 'Close dictionary lookup' : 'Open dictionary lookup'}
                title={isOpen ? 'Close dictionary lookup' : 'Open dictionary lookup'}
            >
                {isOpen ? '✕' : '📖'}
            </button>

            {/* Overlay backdrop */}
            {isOpen && (
                <div 
                    className="dictionary-lookup-overlay"
                    onClick={handleToggle}
                />
            )}

            {/* Sidebar */}
            <div className={`dictionary-lookup-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="dictionary-lookup-header">
                    <h3>Dictionary Lookup</h3>
                    <button 
                        className="dictionary-lookup-close"
                        onClick={handleToggle}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                
                <div className="dictionary-lookup-content">
                    <SearchBar
                        devanagariString={devSearchStr}
                        slp1LatinStr={slp1SearchStr}
                        onInputChange={keyboardType === 'qwerty' ? handleDirectInput : () => {}}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        handleSearch={handleSearch}
                        keyboardType={keyboardType}
                        onKeyboardTypeChange={setKeyboardType}
                        onDropdownItemClick={handleDropdownItemClick}
                        apiUrl={effectiveApiUrl}
                        onClear={handleClearInput}
                        onDropdownItemSelected={handleDropdownItemSelected}
                    />

                    {keyboardType === 'devanagari' && (
                        <KeyboardBridge
                            ref={keyboardRef}
                            isFocused={isFocused}
                            onInput={handleInput}
                            value={slp1SearchStr}
                            apiUrl={effectiveApiUrl}
                            onSuggestionSearch={handleDropdownItemClick}
                        />
                    )}

                    <div className="dictionary-lookup-results">
                        <Entries
                            entries={entries}
                            highlightedEntryWord={highlightedEntryWord}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

export default DictionaryLookup;

