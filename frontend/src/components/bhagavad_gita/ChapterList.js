import React, { useState, useEffect } from 'react';
import './ChapterList.css';

function ChapterList({ 
  chapters, 
  selectedChapter, 
  onChapterSelect, 
  onVerseSelect,
  apiUrl,
  isLoadingChapters 
}) {
  const [expandedChapters, setExpandedChapters] = useState(new Set());
  const [chapterVerses, setChapterVerses] = useState({});
  const [loadingVerses, setLoadingVerses] = useState({});

  const toggleChapter = async (chapterNumber) => {
    const newExpanded = new Set(expandedChapters);
    
    if (newExpanded.has(chapterNumber)) {
      // Collapse
      newExpanded.delete(chapterNumber);
    } else {
      // Expand - fetch verses if not already loaded
      newExpanded.add(chapterNumber);
      if (!chapterVerses[chapterNumber]) {
        await fetchChapterVerses(chapterNumber);
      }
    }
    
    setExpandedChapters(newExpanded);
  };

  const fetchChapterVerses = async (chapterNumber) => {
    if (!apiUrl) return;
    
    setLoadingVerses(prev => ({ ...prev, [chapterNumber]: true }));
    
    try {
      const response = await fetch(
        `${apiUrl}/v2/bhagavad_gita/verses?chapter=${chapterNumber}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch verses: ${response.statusText}`);
      }
      
      const data = await response.json();
      const versesData = Array.isArray(data) ? data : (data ? [data] : []);
      
      // Filter only original verses and sort by verse_number
      const originalVerses = versesData
        .filter(v => v.type === 'original_verse' && v.verse_number)
        .sort((a, b) => {
          // Sort by verse_number (e.g., "1.1", "1.2", "2.1")
          // Split verse_number into chapter and verse parts
          const aParts = a.verse_number.split('.').map(Number);
          const bParts = b.verse_number.split('.').map(Number);
          
          // Compare chapter first, then verse
          if (aParts[0] !== bParts[0]) {
            return aParts[0] - bParts[0];
          }
          return (aParts[1] || 0) - (bParts[1] || 0);
        });
      
      setChapterVerses(prev => ({
        ...prev,
        [chapterNumber]: originalVerses
      }));
    } catch (err) {
      console.error(`Error fetching verses for chapter ${chapterNumber}:`, err);
      setChapterVerses(prev => ({
        ...prev,
        [chapterNumber]: []
      }));
    } finally {
      setLoadingVerses(prev => ({ ...prev, [chapterNumber]: false }));
    }
  };

  const handleVerseClick = (chapterNumber, verseNumber) => {
    // Select the chapter if not already selected
    if (selectedChapter !== chapterNumber) {
      onChapterSelect(chapterNumber);
    }
    // Then select the verse
    onVerseSelect(verseNumber);
  };

  if (isLoadingChapters) {
    return <div className="chapter-list-loading">Loading chapters...</div>;
  }

  if (!chapters || chapters.length === 0) {
    return <div className="chapter-list-empty">No chapters available</div>;
  }

  return (
    <div className="chapter-list">
      {chapters.map((chapter) => {
        const isExpanded = expandedChapters.has(chapter.chapter_number);
        const verses = chapterVerses[chapter.chapter_number] || [];
        const isLoading = loadingVerses[chapter.chapter_number];
        const isSelected = selectedChapter === chapter.chapter_number;

        return (
          <div 
            key={chapter.chapter_number} 
            className={`chapter-item ${isSelected ? 'selected' : ''}`}
          >
            <div 
              className="chapter-header"
              onClick={() => toggleChapter(chapter.chapter_number)}
            >
              <span className="chapter-expand-icon">
                {isExpanded ? '▼' : '▶'}
              </span>
              <span className="chapter-title">
                Chapter {chapter.chapter_number}
              </span>
              {chapter.verse_count && (
                <span className="chapter-verse-count">
                  ({chapter.verse_count} verses)
                </span>
              )}
            </div>
            
            {isExpanded && (
              <div className="chapter-verses">
                {isLoading ? (
                  <div className="verses-loading">Loading verses...</div>
                ) : verses.length === 0 ? (
                  <div className="verses-empty">No verses found</div>
                ) : (
                  <ul className="verses-list">
                    {verses.map((verse) => (
                      <li
                        key={verse._id || verse.verse_number}
                        className="verse-item"
                        onClick={() => handleVerseClick(chapter.chapter_number, verse.verse_number)}
                      >
                        Verse {verse.verse_number}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ChapterList;

