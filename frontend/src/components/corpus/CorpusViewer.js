import React, { useEffect, useState } from 'react';
import CorpusVerse from './CorpusVerse';
import '../hitopadesa/Hitopadesa.css';

const VERSES_PER_PAGE = 10;

function CorpusViewer({ corpusName, showSearchIcon = false, onSearchClick, versesPerPage = 10 }) {
  const [apiUrl, setApiUrl] = useState('');
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const url = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
    setApiUrl(url);
  }, []);

  useEffect(() => {
    fetchChapters();
  }, [apiUrl, corpusName]);

  useEffect(() => {
    if (selectedChapter !== null) {
      fetchVerses(selectedChapter);
      setCurrentPage(1); // Reset to first page when chapter changes
    }
  }, [selectedChapter, apiUrl, corpusName]);

  const fetchChapters = async () => {
    if (!apiUrl || !corpusName) return;
    setIsLoadingChapters(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/v2/${corpusName}/chapters`);
      if (!response.ok) {
        throw new Error(`Failed to fetch chapters: ${response.statusText}`);
      }
      const data = await response.json();
      // Ensure data is an array (handle null/undefined responses)
      const chaptersData = Array.isArray(data) ? data : (data ? [data] : []);
      setChapters(chaptersData);
      // Auto-select first chapter if available
      if (chaptersData.length > 0 && selectedChapter === null) {
        setSelectedChapter(chaptersData[0].chapter_number);
      }
    } catch (err) {
      console.error('Error fetching chapters:', err);
      setError('Unable to load chapters. Please try again.');
      setChapters([]); // Ensure chapters is always an array, even on error
    } finally {
      setIsLoadingChapters(false);
    }
  };

  const fetchVerses = async (chapterNumber) => {
    if (!apiUrl || !corpusName) return;
    setIsLoadingVerses(true);
    setError('');
    try {
      const response = await fetch(
        `${apiUrl}/v2/${corpusName}/verses?chapter=${chapterNumber}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch verses: ${response.statusText}`);
      }
      const data = await response.json();
      // Ensure data is an array
      const versesData = Array.isArray(data) ? data : (data ? [data] : []);
      console.log('Fetched data:', versesData.length, 'items');
      console.log('Sample items:', versesData.slice(0, 3));
      
      // Sort by chapter_sequence_index as fallback (backend should already sort, but ensure client-side order)
      const sortedData = [...versesData].sort((a, b) => {
        const aSeq = a.chapter_sequence_index || 0;
        const bSeq = b.chapter_sequence_index || 0;
        return aSeq - bSeq;
      });
      
      // Log counts
      const verseCount = sortedData.filter(item => item.type === 'verse' || item.verse_number).length;
      const proseCount = sortedData.filter(item => item.type === 'prose' || item.prose_number).length;
      console.log(`Sorted: ${sortedData.length} items (${verseCount} verses, ${proseCount} prose)`);
      
      setVerses(sortedData);
    } catch (err) {
      console.error('Error fetching verses:', err);
      setError('Unable to load verses. Please try again.');
      setVerses([]);
    } finally {
      setIsLoadingVerses(false);
    }
  };

  const handleChapterChange = (event) => {
    const chapterNum = parseInt(event.target.value, 10);
    setSelectedChapter(chapterNum);
  };

  // Pagination logic
  const totalPages = Math.ceil(verses.length / versesPerPage);
  const startIndex = (currentPage - 1) * versesPerPage;
  const endIndex = startIndex + versesPerPage;
  const currentVerses = verses.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedChapterData = chapters && chapters.length > 0 
    ? chapters.find((ch) => ch.chapter_number === selectedChapter)
    : null;

  return (
    <div className="hitopadesa-wrapper">
      <div className="hitopadesa-controls">
        <div className="hitopadesa-chapter-selector">
          <label htmlFor="chapter-select">Chapter:</label>
          <select
            id="chapter-select"
            value={selectedChapter !== null ? selectedChapter : ''}
            onChange={handleChapterChange}
            disabled={isLoadingChapters || !chapters || chapters.length === 0}
            className="chapter-dropdown"
          >
            {(!chapters || chapters.length === 0) && (
              <option value="">{isLoadingChapters ? 'Loading...' : 'No chapters available'}</option>
            )}
            {chapters && chapters.map((chapter) => (
              <option key={chapter.chapter_number} value={chapter.chapter_number}>
                Chapter {chapter.chapter_number}
              </option>
            ))}
          </select>
        </div>
        {selectedChapterData && (
          <div className="hitopadesa-chapter-info">
            <span>
              {selectedChapterData.verse_count} verses
              {selectedChapterData.first_verse && selectedChapterData.last_verse && (
                <> • {selectedChapterData.first_verse} - {selectedChapterData.last_verse}</>
              )}
            </span>
          </div>
        )}
        {showSearchIcon && onSearchClick && (
          <button
            className="pancatantra-search-icon-button"
            onClick={onSearchClick}
            aria-label="Search"
            title="Search by theme"
          >
            🔍
          </button>
        )}
      </div>

      {error && <div className="hitopadesa-error">{error}</div>}

      {isLoadingVerses && (
        <div className="hitopadesa-loading">Loading verses...</div>
      )}

      {!isLoadingVerses && verses.length === 0 && selectedChapter !== null && (
        <div className="hitopadesa-empty">No verses found for this chapter.</div>
      )}

      {!isLoadingVerses && currentVerses.length > 0 && (
        <>
          <div className="hitopadesa-verses">
            {currentVerses.map((verse) => {
              // Use chapter_sequence_index for key if available, otherwise fallback to verse_number or prose_number
              const key = verse.chapter_sequence_index 
                ? `item-${verse.chapter_sequence_index}` 
                : (verse.verse_number || verse.prose_number || `verse-${verse.verse_index}`);
              return (
                <CorpusVerse 
                  key={key} 
                  verse={verse} 
                  apiUrl={apiUrl}
                  corpusName={corpusName}
                  onUpdate={() => fetchVerses(selectedChapter)}
                />
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="hitopadesa-pagination">
              <button
                className="pagination-button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="pagination-button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CorpusViewer;

