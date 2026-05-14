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
  onSectionSelect,
  apiUrl,
  isLoadingChapters,
  onAfterSelect,
}) {
  const initialChip = selectedChapter || (chapters && chapters[0]?.chapter_number) || 1;
  const [activeChip, setActiveChip] = useState(initialChip);
  const [verses, setVerses] = useState([]);
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);
  const [expandedRationale, setExpandedRationale] = useState(null);
  // Accordion: only one section expanded at a time. Resets to null on
  // chapter switch so the user starts fresh in each chapter.
  const [expandedSection, setExpandedSection] = useState(null);
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

  // Reset transient state, then auto-expand the section that contains the
  // currently-selected verse so the user's reading position is visible in
  // context. Only triggers when the user is browsing the same chapter
  // they're reading.
  useEffect(() => {
    setExpandedRationale(null);
    const sections =
      (chapters || []).find((c) => c.chapter_number === activeChip)
        ?.key_sections;
    if (!sections || !selectedVerseNumber) {
      setExpandedSection(null);
      return;
    }
    const [curMajorStr, curMinorStr] = selectedVerseNumber.split('.');
    const curMajor = parseInt(curMajorStr, 10);
    const curMinor = parseInt(curMinorStr || '0', 10);
    if (curMajor !== activeChip) {
      setExpandedSection(null);
      return;
    }
    const idx = sections.findIndex((sec) => {
      const [sMajor, sMinor] = sec.start_verse.split('.').map(Number);
      const [eMajor, eMinor] = sec.end_verse.split('.').map(Number);
      if (sMajor !== activeChip || eMajor !== activeChip) return false;
      return curMinor >= (sMinor || 0) && curMinor <= (eMinor || 0);
    });
    setExpandedSection(idx !== -1 ? idx : null);
  }, [activeChip, selectedVerseNumber, chapters]);

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

  const activeChipName = BHAGAVAD_GITA_CHAPTER_NAMES[activeChip] || '';
  const activeChapterMeta =
    (chapters || []).find((c) => c.chapter_number === activeChip) || null;

  return (
    <div className="chapter-verse-sheet">
      <div className="chapter-chip-strip-wrap">
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
      </div>
      <div className="chapter-sheet-intro">
        <div className="chapter-sheet-intro-eyebrow">Chapter {activeChip}</div>
        <h3 className="chapter-sheet-intro-title">
          {activeChapterMeta?.title || activeChipName || `Chapter ${activeChip}`}
        </h3>
        {activeChapterMeta?.summary && (
          <p className="chapter-sheet-intro-summary">{activeChapterMeta.summary}</p>
        )}
      </div>
      {Array.isArray(activeChapterMeta?.key_sections) &&
      activeChapterMeta.key_sections.length > 0 ? (
        <ul className="chapter-sheet-sections">
          {activeChapterMeta.key_sections.map((sec, i) => {
            const isExpanded = expandedSection === i;
            const startIdx = verses.findIndex(
              (v) => v.verse_number === sec.start_verse
            );
            const endIdx = verses.findIndex(
              (v) => v.verse_number === sec.end_verse
            );
            const sectionVerses =
              startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx
                ? verses.slice(startIdx, endIdx + 1)
                : [];
            return (
              <li key={`${sec.start_verse}-${sec.end_verse}-${i}`}>
                <button
                  type="button"
                  className={`chapter-sheet-section-header ${
                    isExpanded ? 'expanded' : ''
                  }`}
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedSection(isExpanded ? null : i)}
                >
                  <span className="section-range">
                    {sec.start_verse}
                    {sec.end_verse && sec.end_verse !== sec.start_verse
                      ? `–${sec.end_verse}`
                      : ''}
                  </span>
                  <span className="section-body">
                    <span className="section-title">{sec.title}</span>
                    {sec.summary && (
                      <span className="section-summary">{sec.summary}</span>
                    )}
                  </span>
                  <span className="section-chevron" aria-hidden="true">
                    {isExpanded ? '▾' : '▸'}
                  </span>
                </button>
                {isExpanded && (
                  <ul className="section-verse-list">
                    {sectionVerses.length === 0 ? (
                      <li className="sheet-status">No verses</li>
                    ) : (
                      sectionVerses.map((verse) => {
                        const isSel =
                          activeChip === selectedChapter &&
                          selectedVerseNumber === verse.verse_number;
                        return (
                          <li
                            key={verse._id || verse.verse_number}
                            className={`sheet-verse-item ${
                              isSel ? 'selected' : ''
                            }`}
                            onClick={() =>
                              handleVerseTap(activeChip, verse.verse_number)
                            }
                          >
                            <div className="sheet-verse-meta">
                              <span className="sheet-verse-number">
                                {verse.verse_number}
                              </span>
                              {verse.primary_theme && (
                                <span className="sheet-verse-theme">
                                  {verse.primary_theme.split('–')[0].trim()}
                                </span>
                              )}
                            </div>
                            {verse.rationale && (
                              <>
                                <p
                                  className={`sheet-verse-rationale ${
                                    expandedRationale === verse.verse_number
                                      ? 'expanded'
                                      : ''
                                  }`}
                                >
                                  {verse.rationale}
                                </p>
                                <button
                                  type="button"
                                  className="sheet-verse-more"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedRationale(
                                      expandedRationale === verse.verse_number
                                        ? null
                                        : verse.verse_number
                                    );
                                  }}
                                >
                                  {expandedRationale === verse.verse_number
                                    ? 'Less'
                                    : 'More'}
                                </button>
                              </>
                            )}
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        /* No LLM sections yet — fall back to the flat verse list. */
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
                    <div className="sheet-verse-meta">
                      <span className="sheet-verse-number">{verse.verse_number}</span>
                      {verse.primary_theme && (
                        <span className="sheet-verse-theme">
                          {verse.primary_theme.split('–')[0].trim()}
                        </span>
                      )}
                    </div>
                    {verse.rationale && (
                      <>
                        <p
                          className={`sheet-verse-rationale ${
                            expandedRationale === verse.verse_number ? 'expanded' : ''
                          }`}
                        >
                          {verse.rationale}
                        </p>
                        <button
                          type="button"
                          className="sheet-verse-more"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRationale(
                              expandedRationale === verse.verse_number
                                ? null
                                : verse.verse_number
                            );
                          }}
                        >
                          {expandedRationale === verse.verse_number ? 'Less' : 'More'}
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default ChapterVerseSheet;
