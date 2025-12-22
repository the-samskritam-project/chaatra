import React, { useEffect, useState, useMemo } from 'react';
import CorpusVerse from './CorpusVerse';
import '../hitopadesa/Hitopadesa.css';

const VERSES_PER_PAGE = 10;

function CorpusViewer({ corpusName, showSearchIcon = false, onSearchClick, versesPerPage = 10, user, token, onSignInSuccess }) {
  const [apiUrl, setApiUrl] = useState('');
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState(corpusName === 'bhagavad_gita' ? 'verses' : 'all'); // 'all', 'verses', 'commentary'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [highlightedVerseId, setHighlightedVerseId] = useState(null);
  const [pendingSearch, setPendingSearch] = useState(null);
  const [allVerseNumbers, setAllVerseNumbers] = useState([]); // Index of all verse numbers
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const url = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8081';
    setApiUrl(url);
  }, []);

  useEffect(() => {
    fetchChapters();
    // Reset filter to default when corpus changes
    if (corpusName === 'bhagavad_gita') {
      setFilter('verses');
      // Build verse index for autocomplete
      buildVerseIndex();
    } else {
      setFilter('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, corpusName]);

  // Build index of all verse numbers for autocomplete
  const buildVerseIndex = async () => {
    if (!apiUrl || corpusName !== 'bhagavad_gita') return;
    
    try {
      // Fetch all chapters first
      const chaptersResponse = await fetch(`${apiUrl}/v2/${corpusName}/chapters`);
      if (!chaptersResponse.ok) return;
      
      const chaptersData = await chaptersResponse.json();
      const chapters = Array.isArray(chaptersData) ? chaptersData : (chaptersData ? [chaptersData] : []);
      
      // Fetch verses for each chapter to build complete index
      const verseNumbersSet = new Set();
      
      // Fetch verses for all chapters in parallel
      const versePromises = chapters.map(async (chapter) => {
        try {
          const response = await fetch(`${apiUrl}/v2/${corpusName}/verses?chapter=${chapter.chapter_number}`);
          if (!response.ok) return [];
          const verses = await response.json();
          const versesArray = Array.isArray(verses) ? verses : (verses ? [verses] : []);
          
          // Extract verse numbers (only original_verse type)
          versesArray.forEach(verse => {
            if (verse.type === 'original_verse' && verse.verse_number) {
              verseNumbersSet.add(verse.verse_number);
            }
          });
        } catch (err) {
          console.error(`Error fetching verses for chapter ${chapter.chapter_number}:`, err);
        }
      });
      
      await Promise.all(versePromises);
      
      // Convert set to sorted array
      const verseNumbers = Array.from(verseNumbersSet).sort((a, b) => {
        const [aChapter, aVerse] = a.split('.').map(Number);
        const [bChapter, bVerse] = b.split('.').map(Number);
        if (aChapter !== bChapter) return aChapter - bChapter;
        return aVerse - bVerse;
      });
      
      setAllVerseNumbers(verseNumbers);
    } catch (err) {
      console.error('Error building verse index:', err);
    }
  };

  useEffect(() => {
    if (selectedChapter !== null) {
      fetchVerses(selectedChapter);
      setCurrentPage(1); // Reset to first page when chapter changes
      // Reset filter to default when chapter changes for bhagavad_gita
      if (corpusName === 'bhagavad_gita') {
        setFilter('verses');
      }
    }
  }, [selectedChapter, apiUrl, corpusName]);

  useEffect(() => {
    // Reset to first page when filter changes
    setCurrentPage(1);
  }, [filter]);

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

  // Update suggestions as user types
  useEffect(() => {
    if (corpusName !== 'bhagavad_gita' || !searchQuery.trim()) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const query = searchQuery.trim();
    const versePattern = /^(\d+)(\.(\d*))?$/;
    const match = query.match(versePattern);
    
    if (!match) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const chapterNum = match[1];
    const verseNum = match[3] || '';
    
    // Filter verse numbers that match the pattern
    const suggestions = allVerseNumbers
      .filter(verseNumStr => {
        if (verseNum) {
          // User has typed chapter.verse - match exact or prefix
          return verseNumStr.startsWith(`${chapterNum}.${verseNum}`);
        } else {
          // User has typed just chapter - show first few verses of that chapter
          return verseNumStr.startsWith(`${chapterNum}.`);
        }
      })
      .slice(0, 10); // Limit to 10 suggestions
    
    setSearchSuggestions(suggestions);
    setShowSuggestions(suggestions.length > 0);
  }, [searchQuery, allVerseNumbers, corpusName]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchError('');
    setHighlightedVerseId(null);
    setShowSuggestions(false);

    const query = searchQuery.trim();
    if (!query) {
      return;
    }

    // Validate format: X.Y (e.g., 1.1, 2.5)
    const versePattern = /^(\d+)\.(\d+)$/;
    const match = query.match(versePattern);
    
    if (!match) {
      setSearchError('Please enter verse in format X.Y (e.g., 1.1)');
      return;
    }

    const chapterNum = parseInt(match[1], 10);
    const verseNum = parseInt(match[2], 10);
    const verseNumber = `${chapterNum}.${verseNum}`;

    // Check if verse exists in our index
    if (!allVerseNumbers.includes(verseNumber)) {
      setSearchError(`Verse ${verseNumber} does not exist`);
      return;
    }

    // Check if chapter exists
    const chapterExists = chapters.some(ch => ch.chapter_number === chapterNum);
    if (!chapterExists) {
      setSearchError(`Chapter ${chapterNum} does not exist`);
      return;
    }

    // If chapter doesn't match current chapter, switch to it
    if (selectedChapter !== chapterNum) {
      setPendingSearch(verseNumber);
      setSelectedChapter(chapterNum);
      // Wait for verses to load before searching
      // The search will be triggered in useEffect when verses are loaded
      return;
    }

    // Find verse in current verses
    findAndHighlightVerse(verseNumber);
  };

  const findAndHighlightVerse = (verseNumber) => {
    const verse = filteredVerses.find(v => v.verse_number === verseNumber);
    
    if (!verse) {
      setSearchError(`Verse ${verseNumber} not found in chapter ${selectedChapter}`);
      return;
    }

    // Find the page that contains this verse
    const verseIndex = filteredVerses.findIndex(v => v.verse_number === verseNumber);
    const targetPage = Math.floor(verseIndex / versesPerPage) + 1;
    
    // Switch to the page containing the verse
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }

    // Generate verse ID for highlighting
    const verseId = verse.sequence_number 
      ? `item-${verse.sequence_number}` 
      : (verse.chapter_sequence_index 
        ? `item-${verse.chapter_sequence_index}` 
        : (verse.verse_number || verse.prose_number || verse._id));
    
    setHighlightedVerseId(verseId);
    
    // Scroll to verse after a short delay to allow page change
    setTimeout(() => {
      const verseElement = document.getElementById(`verse-${verseId}`);
      if (verseElement) {
        verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);

    // Clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedVerseId(null);
    }, 3000);
  };

  // Effect to search for verse after chapter switch and verses load
  useEffect(() => {
    if (pendingSearch && !isLoadingVerses && verses.length > 0) {
      findAndHighlightVerse(pendingSearch);
      setPendingSearch(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapter, verses, isLoadingVerses, pendingSearch]);

  // Filter logic
  const filteredVerses = useMemo(() => {
    if (filter === 'all') return verses;
    
    return verses.filter((verse) => {
      const type = verse.type || (verse.verse_number ? 'verse' : 'prose');
      
      if (filter === 'verses') {
        // For Bhagavad Gita: original_verse, for others: verse
        return type === 'original_verse' || type === 'verse';
      }
      
      if (filter === 'commentary') {
        // For Bhagavad Gita: commentary, for others: prose
        return type === 'commentary' || type === 'prose';
      }
      
      return true;
    });
  }, [verses, filter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredVerses.length / versesPerPage);
  const startIndex = (currentPage - 1) * versesPerPage;
  const endIndex = startIndex + versesPerPage;
  const currentVerses = filteredVerses.slice(startIndex, endIndex);

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
      {corpusName === 'bhagavad_gita' && (
        <div className="hitopadesa-search-container">
          <form onSubmit={handleSearch} className="hitopadesa-search-form">
            <div className="hitopadesa-search-input-wrapper">
              <input
                type="text"
                className="hitopadesa-search-input"
                placeholder="Search verse (e.g., 1.1)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchError(''); // Clear error when user types
                }}
                onFocus={() => {
                  if (searchSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding suggestions to allow clicking on them
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                onKeyDown={(e) => {
                  // Allow Enter key to submit, but also handle Escape to close suggestions
                  if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  }
                }}
                autoComplete="off"
              />
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="hitopadesa-search-suggestions">
                  {searchSuggestions.map((suggestion) => (
                    <div
                      key={suggestion}
                      className="hitopadesa-search-suggestion-item"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        setSearchQuery(suggestion);
                        setShowSuggestions(false);
                        setSearchError('');
                        setHighlightedVerseId(null);
                        
                        // Trigger search after state update
                        setTimeout(() => {
                          const chapterNum = parseInt(suggestion.split('.')[0], 10);
                          const verseNumber = suggestion;
                          
                          // Check if verse exists in our index
                          if (!allVerseNumbers.includes(verseNumber)) {
                            setSearchError(`Verse ${verseNumber} does not exist`);
                            return;
                          }
                          
                          // Check if chapter exists
                          const chapterExists = chapters.some(ch => ch.chapter_number === chapterNum);
                          if (!chapterExists) {
                            setSearchError(`Chapter ${chapterNum} does not exist`);
                            return;
                          }
                          
                          // If chapter doesn't match current chapter, switch to it
                          if (selectedChapter !== chapterNum) {
                            setPendingSearch(verseNumber);
                            setSelectedChapter(chapterNum);
                            return;
                          }
                          
                          // Find verse in current verses
                          findAndHighlightVerse(verseNumber);
                        }, 0);
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
              {searchQuery && (
                <button
                  type="button"
                  className="hitopadesa-search-clear"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchError('');
                    setHighlightedVerseId(null);
                    setShowSuggestions(false);
                  }}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </form>
          {searchError && (
            <div className="hitopadesa-search-error">{searchError}</div>
          )}
        </div>
      )}
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
        {corpusName === 'bhagavad_gita' && (
          <div className="hitopadesa-filter-controls">
            <label>Filter:</label>
            <div className="hitopadesa-filter-buttons">
              <button
                type="button"
                className={`hitopadesa-filter-button ${filter === 'all' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setFilter('all');
                }}
              >
                All
              </button>
              <button
                type="button"
                className={`hitopadesa-filter-button ${filter === 'verses' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setFilter('verses');
                }}
              >
                Verses
              </button>
              <button
                type="button"
                className={`hitopadesa-filter-button ${filter === 'commentary' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setFilter('commentary');
                }}
              >
                Commentary
              </button>
            </div>
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

      {!isLoadingVerses && verses.length > 0 && filteredVerses.length === 0 && (
        <div className="hitopadesa-empty">No items match the selected filter.</div>
      )}

      {!isLoadingVerses && currentVerses.length > 0 && (
        <>
          <div className="hitopadesa-verses">
            {currentVerses.map((verse, index) => {
              // Use chapter_sequence_index for key if available, otherwise fallback to verse_number or prose_number or index
              const key = verse.sequence_number 
                ? `item-${verse.sequence_number}` 
                : (verse.chapter_sequence_index 
                  ? `item-${verse.chapter_sequence_index}` 
                  : (verse.verse_number || verse.prose_number || verse._id || `verse-${index}`));
              const isHighlighted = highlightedVerseId === key;
              return (
                <div key={key} id={`verse-${key}`}>
                  <CorpusVerse 
                    verse={verse} 
                    apiUrl={apiUrl}
                    corpusName={corpusName}
                    onUpdate={() => fetchVerses(selectedChapter)}
                    user={user}
                    token={token}
                    onSignInSuccess={onSignInSuccess}
                    isHighlighted={isHighlighted}
                  />
                </div>
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

