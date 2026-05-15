import React, { useEffect, useMemo, useState } from 'react';
import DictionaryLookup from '../dictionary/DictionaryLookup';
import { PANCATANTRA_BOOKS } from './chapterNames';
import '../hitopadesa/Hitopadesa.css'; // shared pada-chheda tile styles
import './Pancatantra.css';

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:8081';

// Map an interval's item id ("verse_0.1" / "prose_0.11") to its document
// inside the chapter's items array.
function parseItemId(id) {
  if (!id) return null;
  const m = String(id).match(/^(verse|prose)_(.+)$/);
  if (!m) return null;
  return { kind: m[1], number: m[2] };
}

function findItem(itemsByKey, itemId) {
  const parsed = parseItemId(itemId);
  if (!parsed) return null;
  return itemsByKey.get(`${parsed.kind}:${parsed.number}`) || null;
}

// Split a Devanagari line on danda punctuation; restore the danda
// onto the right-hand side of each chunk.
function splitOnDandas(text) {
  if (!text) return [];
  const out = [];
  let buf = '';
  for (const ch of text) {
    if (ch === '।' || ch === '॥') {
      const trimmed = (buf + ' ' + ch).trim();
      if (trimmed) out.push(trimmed);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function PadaChheda({ items, itemKey }) {
  const [selected, setSelected] = useState(null);
  // Reset selection when verse changes.
  useEffect(() => setSelected(null), [itemKey]);

  if (!Array.isArray(items) || items.length === 0) return null;
  const picked = selected !== null ? items[selected] : null;
  return (
    <div className="pada-chheda pancatantra-pada">
      <div className="pada-chheda-header">Pada-chheda</div>
      <div className="pada-tiles">
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            className={`pada-tile ${selected === i ? 'selected' : ''}`}
            onClick={() => setSelected(selected === i ? null : i)}
          >
            {it.word}
          </button>
        ))}
      </div>
      {picked && (
        <div className="pada-translation">
          <span className="pada-translation-word">{picked.word}</span>
          <span className="pada-translation-meaning">{picked.translation}</span>
        </div>
      )}
    </div>
  );
}

function IntervalItem({ itemId, label, item }) {
  if (!item) {
    // Item id referenced by the interval but not present in the items
    // fetch — shouldn't happen for a well-formed corpus, but render a
    // small placeholder rather than blowing up.
    return (
      <div className={`pancatantra-item label-${label || 'unknown'}`}>
        <span className="pancatantra-item-label">{label || '—'}</span>
        <span className="pancatantra-item-missing">missing: {itemId}</span>
      </div>
    );
  }

  const isProse = !!item.prose_number;
  const devText = item.transliterated_devanagari || '';
  const devLines = isProse ? [devText] : splitOnDandas(devText);
  const padaItems =
    (item.split_word_by_word_translation &&
      item.split_word_by_word_translation.length > 0 &&
      item.split_word_by_word_translation) ||
    item.word_by_word_translation ||
    [];
  const number = item.verse_number || item.prose_number || '';

  return (
    <div className={`pancatantra-item label-${label || 'narrative'}`}>
      <div className="pancatantra-item-meta">
        <span className="pancatantra-item-label">{label || 'narrative'}</span>
        <span className="pancatantra-item-number">
          {isProse ? 'prose' : 'verse'} {number}
        </span>
      </div>

      <div
        className={`pancatantra-devanagari ${
          isProse ? 'is-prose' : 'is-verse'
        }`}
      >
        {devLines.map((line, i) => (
          <div key={i} className="pancatantra-line">
            {line}
          </div>
        ))}
      </div>

      {!isProse && padaItems.length > 0 && (
        <PadaChheda items={padaItems} itemKey={itemId} />
      )}

      {item.full_translation && (
        <div className="pancatantra-translation">{item.full_translation}</div>
      )}
    </div>
  );
}

function IntervalCard({ interval, items, isExpanded, onToggle }) {
  const verseCount = (interval.verse_numbers || []).length;
  const proseCount = (interval.prose_numbers || []).length;

  return (
    <div className={`pancatantra-interval ${isExpanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="pancatantra-interval-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="pancatantra-interval-meta">
          <span className="pancatantra-interval-index">
            {interval.interval_index}
          </span>
          <span className="pancatantra-interval-count">
            {interval.count || verseCount + proseCount} items
            {(verseCount || proseCount) > 0 && (
              <>
                {' · '}
                {verseCount > 0 && `${verseCount} verse${verseCount > 1 ? 's' : ''}`}
                {verseCount > 0 && proseCount > 0 && ', '}
                {proseCount > 0 && `${proseCount} prose`}
              </>
            )}
          </span>
        </div>
        {interval.interval_summary && (
          <p className="pancatantra-interval-summary">
            {interval.interval_summary}
          </p>
        )}
        {Array.isArray(interval.interval_themes) &&
          interval.interval_themes.length > 0 && (
            <div className="pancatantra-interval-themes">
              {interval.interval_themes.map((t, i) => (
                <span key={i} className="pancatantra-theme-tag">
                  {t}
                </span>
              ))}
            </div>
          )}
        <span className="pancatantra-interval-chevron" aria-hidden="true">
          {isExpanded ? '▾' : '▸'}
        </span>
      </button>

      {isExpanded && (
        <div className="pancatantra-interval-body">
          {(interval.item_ids || []).map((id, i) => (
            <IntervalItem
              key={id}
              itemId={id}
              label={(interval.labels || [])[i]}
              item={findItem(items, id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Pancatantra() {
  const [activeChapter, setActiveChapter] = useState(0);
  const [intervals, setIntervals] = useState([]);
  const [items, setItems] = useState([]);
  const [expandedIdx, setExpandedIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch both intervals + items whenever the active chapter changes.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    setIntervals([]);
    setItems([]);
    setExpandedIdx(0);

    Promise.all([
      fetch(
        `${API_BASE_URL}/v2/pancatantra/intervals?chapter=${activeChapter}`
      ).then((r) => (r.ok ? r.json() : [])),
      fetch(
        `${API_BASE_URL}/v2/pancatantra/verses?chapter=${activeChapter}`
      ).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([intArr, itemsArr]) => {
        if (cancelled) return;
        setIntervals(Array.isArray(intArr) ? intArr : []);
        setItems(Array.isArray(itemsArr) ? itemsArr : []);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load chapter');
      })
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [activeChapter]);

  // Index items by (kind, number) so the interval render can look up by
  // the item_ids array in O(1).
  const itemsByKey = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      if (item.verse_number) {
        map.set(`verse:${item.verse_number}`, item);
      }
      if (item.prose_number) {
        map.set(`prose:${item.prose_number}`, item);
      }
    }
    return map;
  }, [items]);

  return (
    <div className="pancatantra-page">
      <div className="pancatantra-book-chips">
        {PANCATANTRA_BOOKS.map((book) => {
          const isActive = book.chapter_number === activeChapter;
          return (
            <button
              key={book.chapter_number}
              type="button"
              className={`pancatantra-book-chip ${isActive ? 'active' : ''}`}
              onClick={() => setActiveChapter(book.chapter_number)}
              aria-pressed={isActive}
            >
              <span className="pancatantra-book-devanagari">
                {book.devanagari}
              </span>
              <span className="pancatantra-book-english">{book.english}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="pancatantra-error">{error}</div>}

      {isLoading ? (
        <div className="pancatantra-status">Loading book…</div>
      ) : intervals.length === 0 ? (
        <div className="pancatantra-status">No intervals for this book.</div>
      ) : (
        <div className="pancatantra-interval-list">
          {intervals.map((interval, idx) => (
            <IntervalCard
              key={interval._id || idx}
              interval={interval}
              items={itemsByKey}
              isExpanded={expandedIdx === idx}
              onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            />
          ))}
        </div>
      )}

      <DictionaryLookup apiUrl={API_BASE_URL} />
    </div>
  );
}

export default Pancatantra;
