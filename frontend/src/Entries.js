import React from 'react';
import './App.css';
import './utils/subStringMatcher'
import { find } from './utils/subStringMatcher';

function Entries({ entries, devSearchStr }) {
  const highlightText = (text, search) => {
    const indices = find(text, search);
    if (!indices.length) return text;

    const result = [];
    let lastIndex = 0;
    indices.forEach((index) => {
      // Push non-matching text
      result.push(text.substring(lastIndex, index));
      // Push highlighted text
      result.push(<b key={index}>{text.substr(index, search.length)}</b>);
      lastIndex = index + search.length;
    });
    // Add any remaining text after the last match
    result.push(text.substr(lastIndex));

    return result;
  };

  return (
    <div className="entry">
      {entries.length > 0 ? (
        entries.map((entry, index) => (
          <div key={index} className="entry">
            <h3>{entry.devanagariWord}</h3>
            <p>{highlightText(entry.englishMeaning, devSearchStr)}</p>
          </div>
        ))
      ) : (
        <p>No dictionary entries to show.</p>
      )}
    </div>
  );
}

export default Entries;
