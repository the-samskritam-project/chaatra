import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Subhashita.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';

function Subhashita() {
  const navigate = useNavigate();
  const location = useLocation();
  const showBackButton = location.pathname.startsWith('/subhashita/');
  
  const [apiUrl, setApiUrl] = useState('');
  const [verse, setVerse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';
    setApiUrl(url);
    fetchRandomVerse();
  }, []);

  const fetchRandomVerse = async () => {
    if (!apiUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/subhashita/random`);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
      }
      const data = await response.json();
      setVerse(data);
    } catch (err) {
      console.error('Subhashita fetch error:', err);
      setError('Unable to fetch a random subhashita. Please try again.');
      setVerse(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="subhashita-container">
      {showBackButton && (
        <button
          onClick={() => navigate('/subhashita')}
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: '#666'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e0e0e0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f5f5f5';
          }}
        >
          ← Back to Subhashita
        </button>
      )}
      
      <div className="subhashita-card">
        <div className="subhashita-header">
          <h2>महासुभाषितसंग्रहः | Mahasubhashitasangraha</h2>
          <p className="subhashita-description">
            Discover random verses from the great collection of subhashitas.
          </p>
        </div>

        <button
          type="button"
          className="subhashita-button"
          onClick={fetchRandomVerse}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Get Random Subhashita'}
        </button>

        {error && <div className="subhashita-error">{error}</div>}

        {isLoading && !verse && (
          <div className="subhashita-loading">Loading a random subhashita...</div>
        )}

        {verse && (
          <div className="subhashita-result">
            <div className="subhashita-meta">
              <span>Verse {verse.verse_number}</span>
            </div>
            {verse.transliterated_devanagari && (
              <div className="subhashita-devanagari">
                {verse.transliterated_devanagari.split('\n').map((line, index) => (
                  <div key={index} className="subhashita-line">
                    {line}
                  </div>
                ))}
              </div>
            )}
            {verse.full_translation && (
              <div className="subhashita-translation">
                {verse.full_translation}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Subhashita;

