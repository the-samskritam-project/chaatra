import React, { useEffect, useState } from 'react';
import RamayanaResult from './RamayanaResult';
import './Ramayana.css';

function RamayanaSearch() {
  const [apiUrl, setApiUrl] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
    setApiUrl(url);
  }, []);

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!apiUrl || !query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${apiUrl}/v2/search/ramayana?q=${encodeURIComponent(query)}&n=20`
      );
      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
      }
      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error('Ramayana search error:', err);
      setError('Unable to fetch results. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="entries-container ramayana-wrapper">
      <form className="search-bar ramayana-search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search Ramayana by theme or meaning..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        <button type="submit" className="search-button" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className="ramayana-error">{error}</div>}

      <div className="entries ramayana-entries">
        {results.length === 0 && !isLoading && !error && (
          <div className="empty-state">
            <p>Enter a theme to explore relevant shlokas.</p>
          </div>
        )}
        {results.map((entry, index) => (
          <RamayanaResult key={`${entry.metadata?.kanda || 'ramayana'}-${index}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}

export default RamayanaSearch;

