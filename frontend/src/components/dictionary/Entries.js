import React from 'react';
import '../../utils/subStringMatcher'
import { find } from '../../utils/subStringMatcher';
import { virama, signsToVowels } from '../../utils/constants';
import emptyStateImage from '../../images/search.webp'; // Import the image
import { toDevanagiriString } from '../../utils/transliterate';
import { useState } from 'react';
import FlashCardService from '../../services/FlashCardService';

function Entries({ entries, devSearchStr }) {
  const [addedEntries, setAddedEntries] = useState([]);

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

  const flashCardService = new FlashCardService();

  const handleAddEntry = (entry) => {
    const { Word, Type, Meanings } = entry;

    const title = Word;
    const body = Meanings.join('\n');
    const tags = [Type];

    const flashCard = {
      title,
      body,
      tags,
      createdAt: new Date().toISOString(),
    };

    try {
      flashCardService.createFlashCard(flashCard);
      setAddedEntries([...addedEntries, entry.Word]);
    } catch (error) {
      console.error('Error creating flashcard:', error.message);
    }
  };

  const flashCardExists = function (word) {
    const entry = flashCardService.getFlashCardByTitle(word);

    return entry != null;
  }

  return (
    <div>
      {entries.length > 0 ? (
        entries.map((entry, index) => (
          <div key={index} className="entry">
            {flashCardExists(entry.Word) || addedEntries.includes(entry.Word) ? (
              <button className="card-added">
                Added
              </button>
            ) : (
              <button className="add-button" onClick={() => handleAddEntry(entry)}>
                Add
              </button>
            )}
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
