import React, { useState, useEffect } from 'react';
import SearchBar from './Search'; // Assuming your search bar component
import Keyboard from './Keyboard'; // Assuming your keyboard component
import { toDevanagiriString } from './utils/transliterate';
import { vowels, consonants } from './utils/constants';
import { getLastWord as getCurrentWord } from './utils/split';

function SearchKeyboard({ handleSearch }) {
  const [isKeyboardDocked, setIsKeyboardDocked] = useState(true);
  // SLP1 : https://en.wikipedia.org/wiki/SLP1
  const [slp1LatinStr, setSlp1LatinStr] = useState('');
  const [devanagariString, setDevanagariString] = useState('');
  const [activeKeys, setActiveKeys] = useState([]);
  const [searchInFocus, setSearchInFocus] = useState(false);
  const [completionResults, setCompletionResults] = useState([]);

  const handleInputChange = () => {
    if (isKeyboardDocked) {
      setIsKeyboardDocked(false);
    }
  };

  const handleFocus = () => {
    setSearchInFocus(true);
    setIsKeyboardDocked(false);
  };

  const handleBlur = () => {
    setSearchInFocus(false);
    setIsKeyboardDocked(true);
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter') {
        setIsKeyboardDocked(true);
        handleSearch(slp1LatinStr, devanagariString);

        return;
      } else if (event.key === 'Backspace' && devanagariString.length >= 0) {
        setSlp1LatinStr(slp1LatinStr.slice(0, -1));
        setActiveKeys(activeKeys.slice(0, -1));
        setDevanagariString(devanagariString.slice(0, -1));
      } else {
        const found = [...vowels, ...consonants].find(v => v.key === event.key);
        if (found) {
          setDevanagariString(toDevanagiriString(slp1LatinStr + found.key));
          setSlp1LatinStr(slp1LatinStr + found.key);
          setActiveKeys([...activeKeys, event.key]);
        } else if (event.key === 'Spacebar' || event.key === ' ') {
          setDevanagariString(devanagariString + ' ');
          setSlp1LatinStr(slp1LatinStr + ' ');
          setActiveKeys([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchInFocus, devanagariString, slp1LatinStr]);

  useEffect(() => {
    const currentWord = getCurrentWord(slp1LatinStr);

    if (currentWord.length > 0) {
      if (currentWord.charAt(currentWord.length-1) == ' ') {
        setCompletionResults([]);
        return;
      }

      const fetchResults = async () => {
        const url = `http://localhost:8081/complete?slp1=${encodeURIComponent(currentWord)}`;
        const response = await fetch(url);
        const data = await response.json();
        setCompletionResults(data);
      }

      fetchResults();
    }
  }, [slp1LatinStr]);

  return (
    <div>
      <SearchBar
        devanagariString={devanagariString}
        onInputChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <Keyboard
        isDocked={isKeyboardDocked}
        activeKeys={activeKeys}
        alphabet={vowels.concat(consonants)}
        completionResults={completionResults}
      />
    </div>
  );
}

export default SearchKeyboard;
