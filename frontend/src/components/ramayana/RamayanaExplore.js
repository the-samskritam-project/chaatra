import React, { useEffect, useMemo, useState } from 'react';
import './RamayanaExplore.css';

const difficultyLabels = [
  { threshold: 0.25, label: 'Easy' },
  { threshold: 0.5, label: 'Moderate' },
  { threshold: 0.75, label: 'Challenging' },
  { threshold: 1, label: 'Intense' },
];

function RamayanaExplore() {
  const [apiUrl, setApiUrl] = useState('');
  const [sliderValue, setSliderValue] = useState(0.35);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [entry, setEntry] = useState(null);
  const [matchedScore, setMatchedScore] = useState(0);

  useEffect(() => {
    const url = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
    setApiUrl(url);
  }, []);

  const difficultyLabel = useMemo(() => {
    const val = sliderValue;
    return (
      difficultyLabels.find((item) => val <= item.threshold)?.label || 'Easy'
    );
  }, [sliderValue]);

  const handleFetch = async () => {
    if (!apiUrl) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${apiUrl}/v2/ramayana/explore?score=${sliderValue.toFixed(2)}`
      );
      if (!response.ok) {
        throw new Error(`Explore request failed: ${response.statusText}`);
      }
      const data = await response.json();
      setEntry(data.shloka || null);
      setMatchedScore(data.matched_score ?? 0);
    } catch (err) {
      console.error('Ramayana explore error:', err);
      setError('Unable to fetch a shloka. Please try again.');
      setEntry(null);
      setMatchedScore(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSliderChange = (event) => {
    setSliderValue(Number(event.target.value));
  };

  return (
    <div className="ramayana-explore">
      <div className="explore-card">
        <div className="explore-header">
          <div>
            <h2>Explore Ramayana by difficulty</h2>
            <p className="explore-description">
              Discover serendipitous shlokas curated across the epic.
            </p>
          </div>
        </div>

        <div className="explore-slider">
          <div className="slider-labels">
            <span>Easy</span>
            <span>Hard</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={sliderValue}
            onChange={handleSliderChange}
          />
          <div className="slider-output">
            <span className="slider-value">{difficultyLabel}</span>
            <span className="slider-score">
              Target score: {sliderValue.toFixed(2)}
            </span>
          </div>
        </div>

        <p className="explore-footnote">
          Slide from easy to intense to discover shlokas with varying lexical
          rarity and sandhi complexity.
        </p>

        <button
          type="button"
          className="explore-button"
          onClick={handleFetch}
          disabled={isLoading}
        >
          {isLoading ? 'Fetching...' : "I'm Feeling Lucky"}
        </button>

        {error && <div className="explore-error">{error}</div>}

        {entry && (
          <div className="explore-result">
            <div className="explore-meta">
              <span>
                {entry.kanda} · Sarga {entry.sarga}, Shloka {entry.shloka}
              </span>
              <span>Matched score: {matchedScore.toFixed(2)}</span>
            </div>
            <p className="explore-sanskrit">{entry.shloka_text}</p>
            {entry.translation && (
              <p className="explore-translation">{entry.translation}</p>
            )}
            {entry.explanation && (
              <p className="explore-explanation">{entry.explanation}</p>
            )}
            <div className="explore-metrics">
              <div>
                <span>Split words</span>
                <strong>{entry.metrics?.split_word_count ?? '—'}</strong>
              </div>
              <div>
                <span>Split complexity</span>
                <strong>
                  {(entry.metrics?.split_complexity_score ?? 0).toFixed(2)}
                </strong>
              </div>
              <div>
                <span>Rarity</span>
                <strong>
                  {(entry.metrics?.rarity_score ?? 0).toFixed(3)}
                </strong>
              </div>
              <div>
                <span>Complexity</span>
                <strong>
                  {(entry.metrics?.complexity_score ?? 0).toFixed(3)}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RamayanaExplore;

