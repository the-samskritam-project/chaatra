import React, { useEffect, useRef, useState } from 'react';
import { BHAGAVAD_GITA_CHAPTER_NAMES } from './chapterNames';

// Mobile chapter+verse picker rendered inside the bottom sheet.
// Top: horizontal-scroll chip strip of all 18 chapters.
// Below: vertical list of verses for whichever chip is "active".
// Tapping a chip browses without committing; tapping a verse commits
// both the chapter and verse, then calls onAfterSelect to close the sheet.
function ChapterVerseSheet({
  chapters,
  selectedChapter,
  selectedVerseNumber,
  onChapterSelect,
  onVerseSelect,
  apiUrl,
  isLoadingChapters,
  onAfterSelect,
}) {
  const initialChip = selectedChapter || (chapters && chapters[0]?.chapter_number) || 1;
  const [activeChip, setActiveChip] = useState(initialChip);
  const [verses, setVerses] = useState([]);
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);
  const stripRef = useRef(null);
  const activeChipRef = useRef(null);

  useEffect(() => {
    if (selectedChapter) setActiveChip(selectedChapter);
  }, [selectedChapter]);

  useEffect(() => {
    if (activeChipRef.current && stripRef.current) {
      activeChipRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeChip]);

  useEffect(() => {
    if (!apiUrl || !activeChip) return;
    let cancelled = false;
    setIsLoadingVerses(true);
    fetch(`${apiUrl}/v2/bhagavad_gita/verses?chapter=${activeChip}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : data ? [data] : [];
        const original = arr
          .filter((v) => v.type === 'original_verse' && v.verse_number)
          .sort((a, b) => {
            const ap = a.verse_number.split('.').map(Number);
            const bp = b.verse_number.split('.').map(Number);
            if (ap[0] !== bp[0]) return ap[0] - bp[0];
            return (ap[1] || 0) - (bp[1] || 0);
          });
        setVerses(original);
      })
      .catch(() => !cancelled && setVerses([]))
      .finally(() => !cancelled && setIsLoadingVerses(false));
    return () => {
      cancelled = true;
    };
  }, [activeChip, apiUrl]);

  if (isLoadingChapters) {
    return <div className="sheet-status">Loading chapters…</div>;
  }
  if (!chapters || chapters.length === 0) {
    return <div className="sheet-status">No chapters available</div>;
  }

  const handleVerseTap = (chapterNum, verseNumber) => {
    if (chapterNum !== selectedChapter) {
      onChapterSelect(chapterNum);
    }
    onVerseSelect(verseNumber);
    if (onAfterSelect) onAfterSelect();
  };

  return (
    <div className="chapter-verse-sheet">
      <div className="chapter-chip-strip" role="tablist" ref={stripRef}>
        {chapters.map((ch) => {
          const num = ch.chapter_number;
          const name = BHAGAVAD_GITA_CHAPTER_NAMES[num] || '';
          const active = num === activeChip;
          return (
            <button
              key={num}
              type="button"
              role="tab"
              aria-selected={active}
              ref={active ? activeChipRef : null}
              className={`chapter-chip ${active ? 'active' : ''}`}
              onClick={() => setActiveChip(num)}
            >
              <span className="chapter-chip-num">{num}</span>
              {name && <span className="chapter-chip-name">{name}</span>}
            </button>
          );
        })}
      </div>
      <div className="chapter-verse-sheet-list">
        {isLoadingVerses ? (
          <div className="sheet-status">Loading verses…</div>
        ) : verses.length === 0 ? (
          <div className="sheet-status">No verses</div>
        ) : (
          <ul className="sheet-verse-list">
            {verses.map((verse) => {
              const isSel =
                activeChip === selectedChapter &&
                selectedVerseNumber === verse.verse_number;
              return (
                <li
                  key={verse._id || verse.verse_number}
                  className={`sheet-verse-item ${isSel ? 'selected' : ''}`}
                  onClick={() => handleVerseTap(activeChip, verse.verse_number)}
                >
                  <span className="sheet-verse-number">{verse.verse_number}</span>
                  {verse.primary_theme && (
                    <span className="sheet-verse-theme">
                      {verse.primary_theme.split('–')[0].trim()}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ChapterVerseSheet;
