import React, { useEffect, useState } from 'react';
import RamayanaResult from './RamayanaResult';
import RamayanaModal from './RamayanaModal';
import './Ramayana.css';

function RamayanaSearch() {
  const [apiUrl, setApiUrl] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [contextData, setContextData] = useState(null);
  const [summary, setSummary] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [contextError, setContextError] = useState('');
  const [isContextLoading, setIsContextLoading] = useState(false);
  const handleResultClick = async (entry) => {
    if (!apiUrl) return;
    const metadata = entry.metadata || {};
    const { kanda, sarga, shloka } = metadata;
    if (!kanda || !sarga || !shloka) {
      setContextError('Missing metadata for context lookup.');
      setContextData(null);
      setSelectedEntry(entry);
      return;
    }

    setSelectedEntry(entry);
    setContextData(null);
    setSummary('');
    setSummaryError('');
    setIsSummaryLoading(false);
    setContextError('');
    setIsContextLoading(true);
    try {
      const response = await fetch(
        `${apiUrl}/v2/ramayana/context?kanda=${encodeURIComponent(
          kanda
        )}&sarga=${sarga}&shloka=${shloka}&window=10`
      );
      if (!response.ok) {
        throw new Error(`Context request failed: ${response.statusText}`);
      }
      const data = await response.json();
      setContextData(data);
    } catch (err) {
      console.error('Ramayana context error:', err);
      setContextError('Unable to load context.');
    } finally {
      setIsContextLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedEntry(null);
    setContextData(null);
    setContextError('');
    setSummary('');
    setSummaryError('');
    setIsSummaryLoading(false);
  };

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

  const handleSummarize = async () => {
    if (!apiUrl || !contextData) return;

    const payload = {
      kanda: contextData.kanda,
      sarga: contextData.sarga,
      shloka: contextData.shloka,
      window: contextData.window || 10,
      prompt: '',
    };

    setSummary('');
    setSummaryError('');
    setIsSummaryLoading(true);

    try {
      const response = await fetch(`${apiUrl}/v2/ramayana/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Summary request failed: ${response.statusText}`);
      }

      const data = await response.json();
      setSummary(data.summary || '');
    } catch (err) {
      console.error('Ramayana summarize error:', err);
      setSummaryError('Unable to generate summary.');
    } finally {
      setIsSummaryLoading(false);
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
          <RamayanaResult
            key={`${entry.metadata?.kanda || 'ramayana'}-${index}`}
            entry={entry}
            onClick={() => handleResultClick(entry)}
          />
        ))}
      </div>

      <RamayanaModal
        isOpen={Boolean(selectedEntry)}
        onClose={closeModal}
        entry={selectedEntry}
        contextData={contextData}
        isLoading={isContextLoading}
        error={contextError}
        onSummarize={handleSummarize}
        isSummaryLoading={isSummaryLoading}
        summary={summary}
        summaryError={summaryError}
        disableSummarize={!contextData}
      />
    </div>
  );
}

export default RamayanaSearch;

