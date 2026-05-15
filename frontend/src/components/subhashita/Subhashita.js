import React, { useEffect, useState } from 'react';
import DictionaryLookup from '../dictionary/DictionaryLookup';
import '../hitopadesa/Hitopadesa.css'; // for the shared .pada-chheda styles
import './Subhashita.css';

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:8081';

// Split a Devanagari text on the danda punctuation and return one entry
// per line, with the danda restored on the appropriate side.
function splitOnDandas(text) {
  if (!text) return [];
  const segments = text.split(/([।॥])/);
  const lines = [];
  let buf = '';
  for (const seg of segments) {
    if (seg === '।' || seg === '॥') {
      buf = (buf + ' ' + seg).trim();
      if (buf) lines.push(buf);
      buf = '';
    } else {
      buf = (buf + ' ' + seg).trim();
    }
  }
  if (buf.trim()) lines.push(buf.trim());
  return lines;
}

function Subhashita() {
  const [themes, setThemes] = useState([]); // [{theme, count}]
  const [activeTheme, setActiveTheme] = useState('');
  const [verses, setVerses] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingThemes, setIsLoadingThemes] = useState(true);
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);
  const [selectedPadaIdx, setSelectedPadaIdx] = useState(null);
  const [error, setError] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Load themes once on mount.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingThemes(true);
    fetch(`${API_BASE_URL}/subhashita/themes`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        setThemes(arr);
        if (arr.length > 0) {
          setActiveTheme((current) => current || arr[0].theme);
        }
      })
      .catch(() => !cancelled && setError('Failed to load themes'))
      .finally(() => !cancelled && setIsLoadingThemes(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Load verses whenever the active theme changes.
  useEffect(() => {
    if (!activeTheme) return;
    let cancelled = false;
    setIsLoadingVerses(true);
    setSelectedPadaIdx(null);
    setError('');
    fetch(
      `${API_BASE_URL}/subhashita/by_theme?theme=${encodeURIComponent(
        activeTheme
      )}`
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        setVerses(arr);
        setCurrentIndex(0);
      })
      .catch(() => !cancelled && setError('Failed to load subhashitas'))
      .finally(() => !cancelled && setIsLoadingVerses(false));
    return () => {
      cancelled = true;
    };
  }, [activeTheme]);

  // Reset pada selection on verse change.
  useEffect(() => {
    setSelectedPadaIdx(null);
  }, [currentIndex]);

  // Close the dropdown whenever the active theme changes.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [activeTheme]);

  const currentVerse = verses[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < verses.length - 1;
  const padaItems =
    (currentVerse && currentVerse.split_word_by_word_translation) || [];
  const selectedPada =
    selectedPadaIdx !== null ? padaItems[selectedPadaIdx] : null;
  const devLines = splitOnDandas(
    currentVerse?.transliterated_devanagari || ''
  );
  const activeThemeCount =
    themes.find((t) => t.theme === activeTheme)?.count ?? 0;

  return (
    <div className="subhashita-page">
      {isLoadingThemes ? (
        <div className="subhashita-status">Loading themes…</div>
      ) : themes.length === 0 ? (
        <div className="subhashita-status">
          No themes yet — run translate_subhashitas to enrich verses.
        </div>
      ) : (
        <div className="chapter-dropdown-wrap subhashita-theme-dropdown">
          <button
            type="button"
            className={`chapter-dropdown-trigger ${isMenuOpen ? 'open' : ''}`}
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={isMenuOpen}
          >
            <span className="chapter-dropdown-current">
              <span className="chapter-dropdown-title">
                {activeTheme || 'Pick a theme'}
              </span>
              {activeThemeCount > 0 && (
                <span className="chapter-dropdown-num">{activeThemeCount}</span>
              )}
            </span>
            <span className="chapter-dropdown-chevron" aria-hidden="true">
              ▾
            </span>
          </button>
          {isMenuOpen && (
            <>
              <div
                className="chapter-dropdown-backdrop"
                onClick={() => setIsMenuOpen(false)}
                aria-hidden="true"
              />
              <ul className="chapter-dropdown-menu" role="listbox">
                {themes.map((t) => {
                  const isActive = t.theme === activeTheme;
                  return (
                    <li key={t.theme}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        className={`chapter-dropdown-item ${
                          isActive ? 'active' : ''
                        }`}
                        onClick={() => {
                          setActiveTheme(t.theme);
                          setIsMenuOpen(false);
                        }}
                      >
                        <span className="chapter-dropdown-title">
                          {t.theme}
                        </span>
                        <span className="chapter-dropdown-num">{t.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="subhashita-reader">
        {error && <div className="subhashita-error">{error}</div>}

        {isLoadingVerses ? (
          <div className="subhashita-status">Loading subhashitas…</div>
        ) : !currentVerse ? (
          <div className="subhashita-status">
            No subhashitas found for this theme.
          </div>
        ) : (
          <>
            <div className="subhashita-card">
              <div className="subhashita-card-header">
                <span className="subhashita-verse-position">
                  {currentIndex + 1} of {verses.length}
                </span>
                {currentVerse.verse_number && (
                  <span className="subhashita-verse-number">
                    #{currentVerse.verse_number}
                  </span>
                )}
              </div>

              <div className="subhashita-devanagari">
                {devLines.length === 0 ? (
                  <div className="subhashita-line">
                    {currentVerse.transliterated_devanagari}
                  </div>
                ) : (
                  devLines.map((line, i) => (
                    <div key={i} className="subhashita-line">
                      {line}
                    </div>
                  ))
                )}
              </div>

              {padaItems.length > 0 && (
                <div className="pada-chheda">
                  <div className="pada-chheda-header">Pada-chheda</div>
                  <div className="pada-tiles">
                    {padaItems.map((item, idx) => (
                      <button
                        key={`pada-${idx}`}
                        type="button"
                        className={`pada-tile ${
                          selectedPadaIdx === idx ? 'selected' : ''
                        }`}
                        onClick={() =>
                          setSelectedPadaIdx(
                            selectedPadaIdx === idx ? null : idx
                          )
                        }
                      >
                        {item.word}
                      </button>
                    ))}
                  </div>
                  {selectedPada && (
                    <div className="pada-translation">
                      <span className="pada-translation-word">
                        {selectedPada.word}
                      </span>
                      <span className="pada-translation-meaning">
                        {selectedPada.translation}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {currentVerse.full_translation && (
                <div className="subhashita-translation">
                  {currentVerse.full_translation}
                </div>
              )}

              {(currentVerse.primary_theme ||
                (currentVerse.secondary_themes || []).length > 0) && (
                <div className="subhashita-theme-tags">
                  {currentVerse.primary_theme && (
                    <span className="subhashita-tag primary">
                      {currentVerse.primary_theme}
                    </span>
                  )}
                  {(currentVerse.secondary_themes || []).map((tag, i) => (
                    <span key={`sec-${i}`} className="subhashita-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="subhashita-nav">
              <button
                type="button"
                className="subhashita-nav-button"
                onClick={() => hasPrev && setCurrentIndex(currentIndex - 1)}
                disabled={!hasPrev}
                aria-label="Previous subhashita"
              >
                ← Prev
              </button>
              <button
                type="button"
                className="subhashita-nav-button shuffle"
                onClick={() => {
                  if (verses.length === 0) return;
                  setCurrentIndex(Math.floor(Math.random() * verses.length));
                }}
                disabled={verses.length === 0}
                aria-label="Random subhashita in this theme"
                title="Random subhashita in this theme"
              >
                🎲
              </button>
              <button
                type="button"
                className="subhashita-nav-button"
                onClick={() => hasNext && setCurrentIndex(currentIndex + 1)}
                disabled={!hasNext}
                aria-label="Next subhashita"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>

      <DictionaryLookup apiUrl={API_BASE_URL} />
    </div>
  );
}

export default Subhashita;
