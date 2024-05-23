import React, { useState, useEffect } from 'react';
import SearchBar from './Search'; // Assuming your search bar component
import Keyboard from './Keyboard'; // Assuming your keyboard component
import './utils/constants'
import { vowelSigns } from './utils/constants';

const vowels = [
  // Vowels
  { key: 'a', devanagari: 'अ' },
  { key: 'A', devanagari: 'आ' },
  { key: 'i', devanagari: 'इ' },
  { key: 'I', devanagari: 'ई' },
  { key: 'u', devanagari: 'उ' },
  { key: 'U', devanagari: 'ऊ' },
  { key: 'f', devanagari: 'ऋ' },
  { key: 'F', devanagari: 'ॠ' },
  { key: 'x', devanagari: 'ऌ' },
  { key: 'X', devanagari: 'ॡ' },
  { key: 'e', devanagari: 'ए' },
  { key: 'E', devanagari: 'ऐ' },
  { key: 'o', devanagari: 'ओ' },
  { key: 'O', devanagari: 'औ' },
  { key: 'M', devanagari: 'ं' },
  { key: 'H', devanagari: 'ः' },
];

const consonants = [
  { key: 'k', devanagari: 'क' }, { key: 'K', devanagari: 'ख' }, { key: 'g', devanagari: 'ग' },
  { key: 'G', devanagari: 'घ' }, { key: 'N', devanagari: 'ङ' }, { key: 'c', devanagari: 'च' },
  { key: 'C', devanagari: 'छ' }, { key: 'j', devanagari: 'ज' }, { key: 'J', devanagari: 'झ' },
  { key: 'Y', devanagari: 'ञ' }, { key: 'w', devanagari: 'ट' }, { key: 'W', devanagari: 'ठ' },
  { key: 'q', devanagari: 'ड' }, { key: 'Q', devanagari: 'ढ' }, { key: 'R', devanagari: 'ण' },
  { key: 't', devanagari: 'त' }, { key: 'T', devanagari: 'थ' }, { key: 'd', devanagari: 'द' },
  { key: 'D', devanagari: 'ध' }, { key: 'n', devanagari: 'न' }, { key: 'p', devanagari: 'प' },
  { key: 'P', devanagari: 'फ' }, { key: 'b', devanagari: 'ब' }, { key: 'B', devanagari: 'भ' },
  { key: 'm', devanagari: 'म' }, { key: 'y', devanagari: 'य' }, { key: 'r', devanagari: 'र' },
  { key: 'l', devanagari: 'ल' }, { key: 'v', devanagari: 'व' }, { key: 'S', devanagari: 'श' },
  { key: 'z', devanagari: 'ष' }, { key: 's', devanagari: 'स' }, { key: 'h', devanagari: 'ह' },
];

function SearchKeyboard({ handleSearch }) {
  const [isKeyboardDocked, setIsKeyboardDocked] = useState(true);
  // SLP1 : https://en.wikipedia.org/wiki/SLP1
  const [slp1LatinStr, setTypedString] = useState('');
  const [devanagariString, setDevanagariString] = useState('');
  const [activeKeys, setActiveKeys] = useState([]);
  const [searchInFocus, setSearchInFocus] = useState(false);
  const [poppingKey, setPoppingKey] = useState('');

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
      } else if (event.key === 'Backspace' && devanagariString.length > 0) {
        setTypedString(slp1LatinStr.slice(0, -1));
        setActiveKeys(activeKeys.slice(0, -1));
        setDevanagariString(devanagariString.slice(0, -1));
      } else {
        const found = [...vowels, ...consonants].find(v => v.key === event.key);
        if (found) {
          setDevanagariString(toDevanagiriString(slp1LatinStr + found.key));
          setTypedString(slp1LatinStr + found.key);
          setActiveKeys([...activeKeys, event.key]);
          setPoppingKey(event.key);
          setTimeout(() => {
            setPoppingKey('');
          }, 300);
        } else if (event.key === 'Spacebar' || event.key === ' ') {
          console.log('Found space');
          setDevanagariString(devanagariString + ' ');
          setTypedString(slp1LatinStr + ' ');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchInFocus, devanagariString, slp1LatinStr]);

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
      />
    </div>
  );
}

function toDevanagiriString(latinStr) {
  const chars = [...latinStr];
  var result = [];
  const l = chars.length;
  var i = 0;
  const halfConsonant = '्';

  for (; ;) {
    if (i == l) {
      break;
    }

    var rune = chars[i]

    if (rune === ' ') {
      result.push(' ');
      i = i + 1;
      continue;
    }

    var found = vowels.find(x => x.key === rune);
    if (found) {
      result.push(found.devanagari);
      i = i + 1;
      continue;
    } else {
      found = consonants.find(x => x.key === rune);
      if (found) {
        if (i + 1 < l) {
          const next = chars[i + 1];
          var nextChar = vowels.find(x => x.key === next);
          if (nextChar) {
            result.push(found.devanagari);

            if (nextChar.devanagari != 'अ') {
              result.push(vowelSigns[nextChar.devanagari]);
            }

            i = i + 2;
            continue;
          }

          nextChar = consonants.find(x => x.key === next);
          if (nextChar) {
            result.push(found.devanagari);
            result.push(halfConsonant);

            i = i + 1;
            continue;
          }
        } else if (i == l - 1) {
          result.push(found.devanagari);
          result.push(halfConsonant);
        }
      }
    }

    i++;
  }

  const res = result.join('');
  return res;
}

export default SearchKeyboard;
