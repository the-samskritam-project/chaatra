import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import Keyboard from './Keyboard';
import { vowels, consonants } from '../../utils/constants';

const KeyboardBridge = forwardRef(({ 
  onInput,
  isFocused,
  value = '',
  apiUrl: propApiUrl,
  onSuggestionSearch
}, ref) => {
  const [isKeyboardDocked, setIsKeyboardDocked] = useState(true);
  const [activeKeys, setActiveKeys] = useState([]);
  const [completionResults, setCompletionResults] = useState([]);
  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    // Use prop if provided, otherwise get from env with fallback
    const url = propApiUrl || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
    setApiUrl(url);
    console.log('KeyboardBridge API URL set to:', url);
  }, [propApiUrl]);

  useEffect(() => {
    console.log('KeyboardBridge useEffect - value:', value, 'apiUrl:', apiUrl);
    
    if (value.length === 0) {
      setCompletionResults([]);
      setActiveKeys([]);
      return;
    }

    const currentWord = value.split(' ').pop();
    console.log('Current word for completion:', currentWord);

    if (currentWord.length === 0) {
      setCompletionResults([]);
      return;
    }

    if (currentWord.charAt(currentWord.length - 1) === ' ') {
      setCompletionResults([]);
      return;
    }

    if (!apiUrl) {
      console.log('No API URL configured, skipping completion fetch');
      return;
    }

    const fetchResults = async () => {
      try {
        const url = `${apiUrl}/complete?slp1=${encodeURIComponent(currentWord)}`;
        console.log('Fetching completion from:', url);
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          // Ensure data is an array
          const results = Array.isArray(data) ? data : [];
          console.log('Keyboard completion results:', results, 'count:', results.length);
          setCompletionResults(results);
        } else {
          console.log('Keyboard completion API error:', response.status, response.statusText);
          setCompletionResults([]);
        }
      } catch (error) {
        console.error('Error fetching completion results:', error);
        setCompletionResults([]);
      }
    };

    // Add a small debounce to avoid too many calls
    const timeoutId = setTimeout(fetchResults, 200);
    return () => clearTimeout(timeoutId);
  }, [value, apiUrl]);

  useEffect(() => {
    // Show keyboard whenever search bar is focused in devanagari mode
    if (isFocused) {
      setIsKeyboardDocked(false);
    }
  }, [isFocused]);

  const handleDismiss = () => {
    setIsKeyboardDocked(true);
  };

  // Expose dismiss method via ref
  useImperativeHandle(ref, () => ({
    dismiss: () => {
      setIsKeyboardDocked(true);
      setActiveKeys([]);
    }
  }));

  const handleSuggestionClick = async (suggestion) => {
    // Extract just the word part if it contains " — " (meaning separator)
    const wordPart = suggestion.split(' — ')[0].trim();
    
    // Get the current word that was used for completion
    const currentWord = value.split(' ').pop();
    
    if (onSuggestionSearch && currentWord) {
      // Search using the current SLP1 prefix - this will return entries
      // that match, and one of them should correspond to the clicked suggestion
      await onSuggestionSearch(currentWord);
    }
    
    // Clear active keys and dismiss keyboard
    setActiveKeys([]);
    setIsKeyboardDocked(true);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter') {
        setIsKeyboardDocked(true);
        onInput({ type: 'enter', value });
        return;
      } else {
        setIsKeyboardDocked(false);
        if (event.key === 'Backspace') {
          onInput({ type: 'backspace', value: value.slice(0, -1) });
          setActiveKeys(activeKeys.slice(0, -1));
        } else {
          const found = [...vowels, ...consonants].find(v => v.key === event.key);
          if (found) {
            onInput({ type: 'key', value: value + found.key });
            setActiveKeys([...activeKeys, event.key]);
          } else if (event.key === 'Spacebar' || event.key === ' ') {
            onInput({ type: 'key', value: value + ' ' });
            setActiveKeys([]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, activeKeys, onInput, value]);

  const keyboardElement = (
    <Keyboard
      isDocked={isKeyboardDocked}
      activeKeys={activeKeys}
      alphabet={vowels.concat(consonants)}
      completionResults={completionResults}
      onDismiss={handleDismiss}
      onSuggestionClick={handleSuggestionClick}
    />
  );

  return createPortal(keyboardElement, document.body);
});

export default KeyboardBridge; 