import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Keyboard from './Keyboard';
import { vowels, consonants } from '../../utils/constants';

function KeyboardBridge({ 
  onInput,
  isFocused,
  value = ''
}) {
  const [isKeyboardDocked, setIsKeyboardDocked] = useState(true);
  const [activeKeys, setActiveKeys] = useState([]);

  useEffect(() => {
    if (isFocused) {
      setIsKeyboardDocked(false);
    }
  }, [isFocused]);

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
      completionResults={[]}
    />
  );

  return createPortal(keyboardElement, document.body);
}

export default KeyboardBridge; 