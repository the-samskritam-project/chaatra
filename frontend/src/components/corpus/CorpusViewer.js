import React, { useEffect, useState, useMemo } from 'react';
import CorpusVerse from './CorpusVerse';
import '../hitopadesa/Hitopadesa.css';
import ChapterList from '../bhagavad_gita/ChapterList';

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
  const [pendingSearch, setPendingSearch] = useState(null);
  const [allVerseNumbers, setAllVerseNumbers] = useState([]); // Index of all verse numbers
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [semanticSearchResults, setSemanticSearchResults] = useState([]);
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [isLoadingSemanticSearch, setIsLoadingSemanticSearch] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedVerseNumber, setSelectedVerseNumber] = useState(null);
  const [navStatus, setNavStatus] = useState({ prev: null, next: null });

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
      if (corpusName === 'bhagavad_gita') {
        // Only set verse 1 if no verse is selected
        if (!selectedVerseNumber) {
          const firstVerse = sortedData.find(v => v.type === 'original_verse' && v.verse_number);
          if (firstVerse && firstVerse.verse_number) {
            setSelectedVerseNumber(normalizeVerseNumber(firstVerse.verse_number));
          }
        }
      }
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
    setSelectedVerseNumber(null);
  };

  const handleChapterSelect = (chapterNum) => {
    setSelectedChapter(chapterNum);
    setSelectedVerseNumber(null);
  };

  const handleVerseSelect = (verseNumber) => {
    const targetNum = normalizeVerseNumber(verseNumber);
    const chapterNum = parseInt(verseNumber.split('.')[0], 10);

    // Same chapter and verses already loaded: just select and render
    if (selectedChapter === chapterNum && verses.length > 0) {
      setSelectedVerseNumber(targetNum);
      return;
    }

    // Different chapter or no verses yet: switch chapter, set target; fetch will run
    setSelectedChapter(chapterNum);
    setSelectedVerseNumber(targetNum);
  };

  // Update suggestions as user types - semantic search only
  useEffect(() => {
    if (corpusName !== 'bhagavad_gita' || !searchQuery.trim()) {
      setSemanticSearchResults([]);
      setIsSemanticSearch(true);
      setShowSuggestions(false);
      return;
    }

    const query = searchQuery.trim();
    setIsSemanticSearch(true);
    setSearchSuggestions([]);
    
    // Debounce semantic search
    const debounceTimer = setTimeout(async () => {
      if (!apiUrl) return;
      
      setIsLoadingSemanticSearch(true);
      try {
        const response = await fetch(
          `${apiUrl}/v2/bhagavad_gita/search?q=${encodeURIComponent(query)}&limit=10`
        );
        
        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }
        
        const results = await response.json();
        setSemanticSearchResults(Array.isArray(results) ? results : []);
        setShowSuggestions(results.length > 0);
      } catch (err) {
        console.error('Semantic search error:', err);
        setSemanticSearchResults([]);
        setShowSuggestions(false);
      } finally {
        setIsLoadingSemanticSearch(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, corpusName, apiUrl]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchError('');
    setShowSuggestions(false);

    const query = searchQuery.trim();
    if (!query) {
      return;
    }

    // Semantic search - if we have results, select the first one
    if (semanticSearchResults.length > 0) {
      const firstResult = semanticSearchResults[0];
      if (firstResult.verse_number) {
        const verseNumber = firstResult.verse_number;
        const chapterNum = firstResult.chapter_number;
        
        // Navigate to the verse
        if (selectedChapter !== chapterNum) {
          setPendingSearch(verseNumber);
          setSelectedChapter(chapterNum);
          setSelectedVerseNumber(verseNumber);
        } else {
          setSelectedVerseNumber(verseNumber);
        }
      }
    } else {
      // No results yet, wait for semantic search to complete
      // The search will be triggered by the useEffect
      setSearchError('Searching...');
    }
  };

  const normalizeVerseNumber = (val) => {
    if (val === null || val === undefined) return '';
    return String(val);
  };

  const goToPrevVerse = () => {
    if (!navStatus.prev) return;
    setSelectedVerseNumber(normalizeVerseNumber(navStatus.prev));
  };

  const goToNextVerse = () => {
    if (!navStatus.next) return;
    setSelectedVerseNumber(normalizeVerseNumber(navStatus.next));
  };


  // Ensure a selected verse for Bhagavad Gita is always set when verses load
  useEffect(() => {
    if (corpusName !== 'bhagavad_gita') return;
    if (isLoadingVerses) return;
    if (filteredVerses.length === 0) return;
    
    // Recompute prev/next
    const idx = selectedVerseNumber
      ? filteredVerses.findIndex(v => normalizeVerseNumber(v.verse_number) === normalizeVerseNumber(selectedVerseNumber))
      : -1;

    // Only set verse 1 if no verse is selected
    if (idx === -1 && !selectedVerseNumber) {
      const firstVerse = filteredVerses.find(v => v.type === 'original_verse' && v.verse_number) || filteredVerses[0];
      if (firstVerse && firstVerse.verse_number) {
        setSelectedVerseNumber(normalizeVerseNumber(firstVerse.verse_number));
        setNavStatus({
          prev: null,
          next: filteredVerses[1]?.verse_number || null,
        });
      }
      return;
    }

    // If verse is selected but not found, don't override - just update nav status
    if (idx === -1) {
      setNavStatus({ prev: null, next: null });
      return;
    }

    setNavStatus({
      prev: idx > 0 ? filteredVerses[idx - 1].verse_number || null : null,
      next: idx < filteredVerses.length - 1 ? filteredVerses[idx + 1].verse_number || null : null,
    });
  }, [corpusName, filteredVerses, isLoadingVerses, selectedVerseNumber]);

  // Pagination logic
  let totalPages = Math.ceil(filteredVerses.length / versesPerPage);
  let startIndex = (currentPage - 1) * versesPerPage;
  let endIndex = startIndex + versesPerPage;
  let currentVerses = filteredVerses.slice(startIndex, endIndex);

  // For Bhagavad Gita, ignore pagination and show only selected verse
  if (corpusName === 'bhagavad_gita') {
    totalPages = 1;
    startIndex = 0;
    endIndex = filteredVerses.length;
    if (selectedVerseNumber && filteredVerses.length > 0) {
      const idx = filteredVerses.findIndex(v => v.verse_number === selectedVerseNumber);
      if (idx !== -1) {
        currentVerses = filteredVerses.slice(idx, idx + 1); // only current
      } else {
        currentVerses = filteredVerses.slice(0, 1);
      }
    } else {
      currentVerses = filteredVerses.slice(0, 1);
    }
  }

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
                placeholder="Search by meaning (e.g., wisdom, detachment, knowledge)"
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
              {showSuggestions && (
                <div className="hitopadesa-search-suggestions">
                  {isLoadingSemanticSearch && (
                    <div className="hitopadesa-search-suggestion-item" style={{ fontStyle: 'italic', color: '#666' }}>
                      Searching...
                    </div>
                  )}
                  {!isLoadingSemanticSearch && semanticSearchResults.length > 0 && semanticSearchResults.map((result, index) => {
                    const verseNumber = result.verse_number || '';
                    const translation = result.full_translation || '';
                    const score = result.score || 0;
                    const snippet = translation.length > 80 ? translation.substring(0, 80) + '...' : translation;
                    
                    return (
                      <div
                        key={`${result.document_id || index}`}
                        className="hitopadesa-search-suggestion-item"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent input blur
                          setShowSuggestions(false);
                          setSearchError('');
                          
                          const chapterNum = result.chapter_number;
                          const verseNum = verseNumber;
                          
                          // Navigate to the verse
                          if (selectedChapter !== chapterNum) {
                            setPendingSearch(verseNum);
                            setSelectedChapter(chapterNum);
                            setSelectedVerseNumber(verseNum);
                          } else {
                            setSelectedVerseNumber(verseNum);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ fontWeight: 'bold' }}>{verseNumber}</div>
                        <div style={{ fontSize: '0.9em', color: '#666', marginTop: '2px' }}>
                          {snippet}
                        </div>
                        <div style={{ fontSize: '0.8em', color: '#999', marginTop: '2px' }}>
                          Score: {score.toFixed(3)}
                        </div>
                      </div>
                    );
                  })}
                  {!isLoadingSemanticSearch && semanticSearchResults.length === 0 && searchQuery.trim() && (
                    <div className="hitopadesa-search-suggestion-item" style={{ fontStyle: 'italic', color: '#666' }}>
                      No results found
                    </div>
                  )}
                </div>
              )}
              {searchQuery && (
                <button
                  type="button"
                  className="hitopadesa-search-clear"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchError('');
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
      {corpusName === 'bhagavad_gita' ? (
        <>
          <div className="hitopadesa-controls">
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

          <div className="bhagavad-gita-layout">
            <div className="bhagavad-gita-chapter-sidebar">
              <ChapterList
                chapters={chapters}
                selectedChapter={selectedChapter}
                selectedVerseNumber={selectedVerseNumber}
                onChapterSelect={handleChapterSelect}
                onVerseSelect={handleVerseSelect}
                apiUrl={apiUrl}
                isLoadingChapters={isLoadingChapters}
              />
            </div>
            <div className="bhagavad-gita-content">
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
                          />
                        </div>
                      );
                    })}
                  </div>

                  {corpusName === 'bhagavad_gita' && (
                    <div className="bhagavad-gita-nav-buttons">
                      <button
                        type="button"
                        className="gita-nav-button"
                        onClick={goToPrevVerse}
                        disabled={!navStatus.prev}
                      >
                        &lt;
                      </button>
                      <div className="bhagavad-gita-nav-current">
                        {selectedVerseNumber || '—'}
                      </div>
                      <button
                        type="button"
                        className="gita-nav-button"
                        onClick={goToNextVerse}
                        disabled={!navStatus.next}
                      >
                        &gt;
                      </button>
                    </div>
                  )}

              {corpusName !== 'bhagavad_gita' && totalPages > 1 && (
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
          </div>
        </>
      ) : (
        <>
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
                      />
                    </div>
                  );
                })}
              </div>

              {corpusName !== 'bhagavad_gita' && totalPages > 1 && (
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
        </>
      )}
    </div>
  );
}

export default CorpusViewer;

