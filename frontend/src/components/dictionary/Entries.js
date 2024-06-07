import React from 'react';
import './App.css';
import './utils/subStringMatcher'
import { find } from './utils/subStringMatcher';
import { virama, signsToVowels } from './utils/constants';
import emptyStateImage from './images/search.webp'; // Import the image

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

  return (
    <div>
      {entries.length > 0 ? (
        entries.map((entry, index) => (
          <div key={index} className="entry">
            <h3>{entry.devanagariWord}</h3>
            <p>{highlightText(entry.englishMeaning, devSearchStr)}</p>
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