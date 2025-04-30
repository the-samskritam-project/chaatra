import React from 'react';
import './Search.css';

function SearchBar({ devanagariString, slp1LatinStr, onInputChange, onFocus, handleBlur, handleSearch, keyboardType, onKeyboardTypeChange }) {
    return (
        <div className="search-bar">
            <div className="input-container">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search..."
                    value={devanagariString}
                    onChange={onInputChange}
                    onFocus={onFocus}
                    onBlur={handleBlur}
                />
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
            </div>
            <button className="search-button" onClick={() => {handleSearch(slp1LatinStr, devanagariString)}}>Search</button>
        </div>
    );
}

export default SearchBar;
