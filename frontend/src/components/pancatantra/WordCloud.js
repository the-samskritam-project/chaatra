import React, { useEffect, useState } from 'react';
import './WordCloud.css';

function PancatantraWordCloud() {
  const [apiUrl, setApiUrl] = useState('');
  const [themesData, setThemesData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
    setApiUrl(url);
  }, []);

  useEffect(() => {
    if (apiUrl) {
      fetchThemesData();
    }
  }, [apiUrl]);

  const fetchThemesData = async () => {
    if (!apiUrl) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/v2/pancatantra/wordcloud`);
      if (!response.ok) {
        throw new Error(`Failed to fetch themes data: ${response.statusText}`);
      }
      const data = await response.json();
      // Ensure data is an array
      const themesArray = Array.isArray(data) ? data : (data ? [data] : []);
      setThemesData(themesArray);
    } catch (err) {
      console.error('Error fetching themes data:', err);
      setError('Unable to load themes data. Please try again.');
      setThemesData([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="themes-wrapper">
      <div className="themes-header">
        <h2>Pancatantra Themes</h2>
        <p>Themes across all intervals, ordered by frequency</p>
      </div>

      {error && <div className="themes-error">{error}</div>}

      {isLoading && (
        <div className="themes-loading">Loading themes...</div>
      )}

      {!isLoading && themesData.length === 0 && !error && (
        <div className="themes-empty">No themes data available.</div>
      )}

      {!isLoading && themesData.length > 0 && (
        <div className="themes-list">
          {themesData.map((item, index) => (
            <div key={index} className="theme-item">
              <span className="theme-name">{item.text}</span>
              <span className="theme-count">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {!isLoading && themesData.length > 0 && (
        <div className="themes-stats">
          <p>Total themes: {themesData.length}</p>
          <p>Most frequent: {themesData[0]?.text} ({themesData[0]?.value} occurrences)</p>
        </div>
      )}
    </div>
  );
}

export default PancatantraWordCloud;
