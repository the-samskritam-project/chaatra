import React from 'react';
import '../../utils/subStringMatcher'
import { find } from '../../utils/subStringMatcher';
import { virama, signsToVowels } from '../../utils/constants';
import emptyStateImage from '../../images/search.webp'; // Import the image
import { toDevanagiriString } from '../../utils/transliterate';

function Entries({ entries, devSearchStr }) {
  const highlightText = (text, search) => {
    const chars = [...text];
    const indices = find(text, search);
    if (!indices.length) return text;

    const result = [];
    let lastIndex = 0;
    indices.forEach((index) => {
      // Push non-matching text
      result.push(text.substring(lastIndex, index));
      // Push highlighted text
      if (index + search.length < text.length - 1
        && (signsToVowels[chars[index + search.length]]
          || chars[index + search.length] == virama)) {
        result.push(<b key={index}>{text.substr(index, search.length + 1)}</b>);
        lastIndex = index + search.length + 1;
      } else {
        result.push(<b key={index}>{text.substr(index, search.length)}</b>);
        lastIndex = index + search.length;
      }
    });
    // Add any remaining text after the last match
    result.push(text.substr(lastIndex));

    return result;
  };

  const handleAddEntry = (entry) => {
    // Logic to create a flashcard and store it in the browser's storage
    const flashcards = JSON.parse(localStorage.getItem('flashcards')) || [];
    flashcards.push(entry);
    localStorage.setItem('flashcards', JSON.stringify(flashcards));
  };
  
  return (
    <div>
      {entries.length > 0 ? (
        entries.map((entry, index) => (
          <div key={index} className="entry">
            <button className="add-button" onClick={() => handleAddEntry(entry)}>
              Add
            </button>
            <h3>{toDevanagiriString(entry.Word)}</h3>
            <p>{entry.Type}</p>
            {entry.Meanings.map((meaning, meaningIndex) => (
              <div key={meaningIndex} className="meaning">
                <p>{highlightText(meaning, devSearchStr)}</p>
              </div>
            ))}
          </div>
        ))
      ) : (
        <div className="empty-state">
          <img src={emptyStateImage} alt="Search!" />
        </div>
      )}
    </div>
  );
}

export default Entries;
