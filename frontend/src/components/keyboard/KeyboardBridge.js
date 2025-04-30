import React, { useState, useEffect } from 'react';
import Keyboard from './Keyboard';
import { toDevanagiriString } from '../../utils/transliterate';
import { vowels, consonants } from '../../utils/constants';
import { getLastWord as getCurrentWord } from '../../utils/split';

function KeyboardBridge({ 
  slp1LatinStr,
  devanagariString,
  onSlp1Change,
  onDevanagariChange,
  isFocused,
  handleSearch
}) {
  const [isKeyboardDocked, setIsKeyboardDocked] = useState(true);
  const [activeKeys, setActiveKeys] = useState([]);
  const [completionResults, setCompletionResults] = useState([]);

  useEffect(() => {
    if (isFocused) {
      setIsKeyboardDocked(false);
    }
  }, [isFocused]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter') {
        setIsKeyboardDocked(true);
        handleSearch(slp1LatinStr, devanagariString);
        return;
      } else {
        setIsKeyboardDocked(false);
        if (event.key === 'Backspace' && devanagariString.length >= 0) {
          onSlp1Change(slp1LatinStr.slice(0, -1));
          onDevanagariChange(devanagariString.slice(0, -1));
          setActiveKeys(activeKeys.slice(0, -1));
        } else {
          const found = [...vowels, ...consonants].find(v => v.key === event.key);
          if (found) {
            const newSlp1 = slp1LatinStr + found.key;
            const newDevanagari = toDevanagiriString(newSlp1);
            onSlp1Change(newSlp1);
            onDevanagariChange(newDevanagari);
            setActiveKeys([...activeKeys, event.key]);
          } else if (event.key === 'Spacebar' || event.key === ' ') {
            onSlp1Change(slp1LatinStr + ' ');
            onDevanagariChange(devanagariString + ' ');
            setActiveKeys([]);
            setCompletionResults([]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, devanagariString, slp1LatinStr, activeKeys, handleSearch, onDevanagariChange, onSlp1Change]);

  const [config, setConfig] = useState({});
  useEffect(() => {
    const apiUrl = process.env.REACT_APP_API_BASE_URL;
    setConfig({ apiUrl });
  }, []);

  useEffect(() => {
    if (slp1LatinStr.length == 0) {
      setCompletionResults([]);
      return;
    }

    const currentWord = getCurrentWord(slp1LatinStr);

    if (currentWord.length > 0) {
      if (currentWord.charAt(currentWord.length - 1) == ' ') {
        return;
      }

      const fetchResults = async () => {
        const url = `${config.apiUrl}/complete?slp1=${encodeURIComponent(currentWord)}`;
        const response = await fetch(url);
        const data = await response.json();
        setCompletionResults(data);
      }

      fetchResults();
    }
  }, [slp1LatinStr, config.apiUrl]);

  return (
    <Keyboard
      isDocked={isKeyboardDocked}
      activeKeys={activeKeys}
      alphabet={vowels.concat(consonants)}
      completionResults={completionResults}
    />
  );
}

export default KeyboardBridge; 