import React, { useEffect, useState } from 'react';
import { BHAGAVAD_GITA_CHAPTER_NAMES } from './chapterNames';

// Chapter+verse picker shared by the desktop sidebar and the mobile
// bottom sheet. Top: a dropdown of all 18 chapters showing the
// LLM-generated title. Below: intro panel + section accordion.
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
  // Accordion: only one section expanded at a time. Resets on chapter switch.
  const [expandedSection, setExpandedSection] = useState(null);
  // Chapter dropdown open state.
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (selectedChapter) setActiveChip(selectedChapter);
  }, [selectedChapter]);

  // Close the dropdown whenever the active chapter changes.
  useEffect(() => {
    setIsMenuOpen(false);
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

  // Prefer the LLM-generated chapter title from the chapters metadata;
  // fall back to the hardcoded short English name if a chapter hasn't
  // been summarised yet.
  const chapterTitleFor = (num) => {
    const meta = (chapters || []).find((c) => c.chapter_number === num);
    return (
      meta?.title ||
      BHAGAVAD_GITA_CHAPTER_NAMES[num] ||
      `Chapter ${num}`
    );
  };

  const activeChapterMeta =
    (chapters || []).find((c) => c.chapter_number === activeChip) || null;

  return (
    <div className="chapter-verse-sheet">
      <div className="chapter-dropdown-wrap">
        <button
          type="button"
          className={`chapter-dropdown-trigger ${isMenuOpen ? 'open' : ''}`}
          onClick={() => setIsMenuOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={isMenuOpen}
        >
          <span className="chapter-dropdown-current">
            <span className="chapter-dropdown-num">{activeChip}</span>
            <span className="chapter-dropdown-title">
              {chapterTitleFor(activeChip)}
            </span>
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
              {chapters.map((ch) => {
                const num = ch.chapter_number;
                const isActive = num === activeChip;
                return (
                  <li key={num}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`chapter-dropdown-item ${
                        isActive ? 'active' : ''
                      }`}
                      onClick={() => {
                        setActiveChip(num);
                        setIsMenuOpen(false);
                      }}
                    >
                      <span className="chapter-dropdown-num">{num}</span>
                      <span className="chapter-dropdown-title">
                        {chapterTitleFor(num)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      {activeChapterMeta?.summary && (
        <div className="chapter-sheet-intro">
          <p className="chapter-sheet-intro-summary">{activeChapterMeta.summary}</p>
        </div>
      )}
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
