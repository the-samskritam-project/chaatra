import React from 'react';
import './App.css';

function Entries({ entries }) {
  return (
    <div className="entry">
      {entries.length > 0 ? (
        entries.map((entry, index) => (
            <div key={index} className="entry">
              <h3>{entry.devanagariWord}</h3>
              <p>{entry.englishMeaning}</p>
            </div>
        ))
      ) : (
        <p>No dictionary entries to show.</p>
      )}
    </div>
  );
}

export default Entries;
