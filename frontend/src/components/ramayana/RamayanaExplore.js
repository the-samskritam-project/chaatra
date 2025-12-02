import React, { useEffect, useMemo, useState } from 'react';
import RamayanaModal from './RamayanaModal';
import { splitShlokaLines } from './shlokaUtils';
import AlignedTextView from '../AlignedTextView';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contextData, setContextData] = useState(null);
  const [contextError, setContextError] = useState('');
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

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
      setContextData(null);
      setContextError('');
      setSummary('');
      setSummaryError('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Ramayana explore error:', err);
      setError('Unable to fetch a shloka. Please try again.');
      setEntry(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSliderChange = (event) => {
    setSliderValue(Number(event.target.value));
  };

  const handleOpenContext = async () => {
    if (!apiUrl || !entry) return;
    setIsModalOpen(true);
    setIsContextLoading(true);
    setContextError('');
    setContextData(null);
    setSummary('');
    setSummaryError('');
    setIsSummaryLoading(false);

    try {
      const response = await fetch(
        `${apiUrl}/v2/ramayana/context?kanda=${encodeURIComponent(
          entry.kanda
        )}&sarga=${entry.sarga}&shloka=${entry.shloka}&window=10`
      );
      if (!response.ok) {
        throw new Error(`Context request failed: ${response.statusText}`);
      }
      const data = await response.json();
      setContextData(data);
    } catch (err) {
      console.error('Ramayana explore context error:', err);
      setContextError('Unable to load context.');
    } finally {
      setIsContextLoading(false);
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
      console.error('Ramayana explore summary error:', err);
      setSummaryError('Unable to generate summary.');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setContextData(null);
    setContextError('');
    setSummary('');
    setSummaryError('');
    setIsSummaryLoading(false);
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
            <span className="slider-value">
              Current difficulty: {difficultyLabel}
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
          {isLoading ? 'Fetching...' : "Explore"}
        </button>

        {error && <div className="explore-error">{error}</div>}

        {entry && (
          <div className="explore-result">
            <div className="explore-meta">
              <span>
                {entry.kanda} · Sarga {entry.sarga}, Shloka {entry.shloka}
              </span>
            </div>
            <div className="explore-sanskrit">
              {splitShlokaLines(entry.shloka_text).map((line, idx) => (
                <span key={`${entry.shloka}-${idx}`} className="shloka-line">
                  {line}
                </span>
              ))}
            </div>
            {entry.translation && (
              <div className="explore-translation-aligned">
                <AlignedTextView
                  sourceText={entry.shloka_text}
                  translation={entry.translation}
                  tokenSeparator=","
                  maxEditDistance={3}
                  sourceClassName="explore-sanskrit-aligned"
                  translationClassName="explore-translation-aligned"
                  highlightClassName="explore-highlight"
                  splitIntoLines={splitShlokaLines}
                />
              </div>
            )}
            {entry.explanation && (
              <p className="explore-explanation">{entry.explanation}</p>
            )}
            <div className="explore-actions">
              <button
                type="button"
                className="explore-context-button"
                onClick={handleOpenContext}
              >
                View context & summary
              </button>
            </div>
          </div>
        )}
      </div>
      <RamayanaModal
        isOpen={isModalOpen}
        onClose={closeModal}
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

export default RamayanaExplore;

