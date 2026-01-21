import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NotesService from '../../services/NotesService';
import FavoritesService from '../../services/FavoritesService';
import UserTranslationsService from '../../services/UserTranslationsService';
import SignInModal from '../auth/SignInModal';
import './UserDashboard.css';

const UserDashboard = ({ user, token, onSignInSuccess, apiUrl }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('notes');
  
  // Notes state
  const [notes, setNotes] = useState([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState(null);
  
  // Favorites state
  const [favorites, setFavorites] = useState([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [favoritesError, setFavoritesError] = useState(null);
  
  // Translations state
  const [translations, setTranslations] = useState([]);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(false);
  const [translationsError, setTranslationsError] = useState(null);
  
  const [showSignInModal, setShowSignInModal] = useState(false);
  
  // Collapsible state - track which categories and corpus sections are expanded
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [expandedCorpus, setExpandedCorpus] = useState(new Set());
  const [expandedChapters, setExpandedChapters] = useState(new Set());
  
  // Verse details cache - store fetched verse data
  const [verseDetailsCache, setVerseDetailsCache] = useState({});

  useEffect(() => {
    if (!user || !token) {
      setShowSignInModal(true);
      return;
    }
    
    // Fetch data when tab changes
    if (activeTab === 'notes') {
      fetchNotes();
    } else if (activeTab === 'favorites') {
      fetchFavorites();
    } else if (activeTab === 'translations') {
      fetchTranslations();
    }
  }, [activeTab, user, token]);

  const fetchNotes = async () => {
    if (!apiUrl || !user || !token) {
      setNotesError('Please sign in to view your notes.');
      return;
    }
    
    setIsLoadingNotes(true);
    setNotesError(null);
    
    try {
      const notesService = new NotesService(apiUrl);
      // Fetch all notes by calling the endpoint without query parameters
      const response = await fetch(`${apiUrl}/v2/notes`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch notes.');
      }
      
      const allNotes = await response.json();
      setNotes(Array.isArray(allNotes) ? allNotes : []);
    } catch (err) {
      console.error('Error fetching notes:', err);
      if (err.message.includes('Authentication required')) {
        setNotesError('Please sign in to view your notes.');
        setShowSignInModal(true);
      } else {
        setNotesError('Unable to fetch notes. Please try again.');
      }
    } finally {
      setIsLoadingNotes(false);
    }
  };

  const fetchFavorites = async () => {
    if (!apiUrl || !user || !token) {
      setFavoritesError('Please sign in to view your favorites.');
      return;
    }
    
    setIsLoadingFavorites(true);
    setFavoritesError(null);
    
    try {
      const favoritesService = new FavoritesService(apiUrl);
      // Fetch all favorites by not providing filters
      const allFavorites = await favoritesService.getFavorites({}, token);
      setFavorites(Array.isArray(allFavorites) ? allFavorites : []);
    } catch (err) {
      console.error('Error fetching favorites:', err);
      if (err.message.includes('Authentication required')) {
        setFavoritesError('Please sign in to view your favorites.');
        setShowSignInModal(true);
      } else {
        setFavoritesError('Unable to fetch favorites. Please try again.');
      }
    } finally {
      setIsLoadingFavorites(false);
    }
  };

  const fetchTranslations = async () => {
    if (!apiUrl || !user || !token) {
      setTranslationsError('Please sign in to view your translations.');
      return;
    }
    
    setIsLoadingTranslations(true);
    setTranslationsError(null);
    
    try {
      const translationsService = new UserTranslationsService(apiUrl);
      const allTranslations = await translationsService.getAllTranslations(token);
      setTranslations(Array.isArray(allTranslations) ? allTranslations : []);
    } catch (err) {
      console.error('Error fetching translations:', err);
      if (err.message.includes('Authentication required')) {
        setTranslationsError('Please sign in to view your translations.');
        setShowSignInModal(true);
      } else {
        setTranslationsError('Unable to fetch translations. Please try again.');
      }
    } finally {
      setIsLoadingTranslations(false);
    }
  };

  const handleSignInSuccess = (result) => {
    if (onSignInSuccess) {
      onSignInSuccess(result);
    }
    setShowSignInModal(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  const formatCorpusName = (corpusName) => {
    const corpusMap = {
      'bhagavad_gita': 'Bhagavad Gita',
      'subhashita': 'Subhashita',
      'ramayana': 'Ramayana',
      'hitopadesa': 'Hitopadesa',
      'pancatantra': 'Pancatantra',
      'aditya_hridaya_stotra': 'Aditya Hridaya Stotra'
    };
    return corpusMap[corpusName] || corpusName;
  };

  const getCorpusCategory = (corpusName) => {
    // Map corpus to main category (like sidebar structure)
    const categoryMap = {
      'bhagavad_gita': { category: 'श्रुतिः | Scriptures', label: 'भगवद्गीता | Bhagavad Gita' },
      'ramayana': { category: 'इतिहासः | Epics', label: 'रामायणम् | Ramayana' },
      'hitopadesa': { category: 'कथा | Fables', label: 'हितोपदेशः | Hitopadesa' },
      'pancatantra': { category: 'कथा | Fables', label: 'पञ्चतन्त्रम् | Pancatantra' },
      'aditya_hridaya_stotra': { category: 'स्तोत्राणि | Stotras', label: 'आदित्यहृदयम् | Aditya Hridaya Stotra' },
      'subhashita': { category: 'सुभाषितम् | Subhashita', label: 'महासुभाषितसंग्रहः | Mahasubhashitasangraha' }
    };
    return categoryMap[corpusName] || { category: 'Other', label: formatCorpusName(corpusName) };
  };

  // Helper function to extract chapter number from verse_number
  const extractChapterNumber = (verseNumber, corpusName) => {
    if (!verseNumber) return '0';
    
    // Subhashita doesn't have chapter structure - all verses go to chapter "0"
    if (corpusName === 'subhashita') {
      return '0';
    }
    
    // For other corpora, verse_number format is typically "chapter.verse" (e.g., "1.1", "2.5")
    const match = verseNumber.match(/^(\d+)/);
    if (match) {
      return match[1];
    }
    
    // Fallback: if no chapter found, use "0"
    return '0';
  };

  // Helper function to sort verses numerically by verse number
  const sortVersesByNumber = (verses) => {
    return [...verses].sort((a, b) => {
      const verseA = a.verse_number || '';
      const verseB = b.verse_number || '';
      
      // Parse verse numbers (e.g., "1.1" -> [1, 1], "2.5" -> [2, 5])
      const parseVerseNumber = (vn) => {
        if (!vn) return [0, 0];
        const parts = vn.split('.').map(part => {
          const num = parseInt(part, 10);
          return isNaN(num) ? 0 : num;
        });
        // Ensure at least 2 parts for proper comparison
        while (parts.length < 2) {
          parts.push(0);
        }
        return parts;
      };
      
      const partsA = parseVerseNumber(verseA);
      const partsB = parseVerseNumber(verseB);
      
      // Compare chapter first, then verse
      if (partsA[0] !== partsB[0]) {
        return partsA[0] - partsB[0];
      }
      return partsA[1] - partsB[1];
    });
  };

  // Group translations by corpus, then by chapter, with proper sorting
  const groupTranslationsByCorpusAndChapter = (translations) => {
    const grouped = {};
    
    translations.forEach(translation => {
      // Fallback: if corpus_name is missing, infer from context
      let corpusName = translation.corpus_name;
      if (!corpusName) {
        const verseNumber = translation.verse_number || '';
        corpusName = verseNumber && !verseNumber.includes('.') ? 'subhashita' : 'unknown';
      }
      
      const categoryInfo = getCorpusCategory(corpusName);
      const chapterNumber = extractChapterNumber(translation.verse_number, corpusName);
      
      if (!grouped[corpusName]) {
        grouped[corpusName] = {
          label: categoryInfo.label,
          chapters: {}
        };
      }
      
      if (!grouped[corpusName].chapters[chapterNumber]) {
        grouped[corpusName].chapters[chapterNumber] = [];
      }
      
      grouped[corpusName].chapters[chapterNumber].push(translation);
    });
    
    // Sort verses within each chapter
    Object.keys(grouped).forEach(corpusName => {
      Object.keys(grouped[corpusName].chapters).forEach(chapterNumber => {
        grouped[corpusName].chapters[chapterNumber] = sortVersesByNumber(
          grouped[corpusName].chapters[chapterNumber]
        );
      });
    });
    
    return grouped;
  };

  const groupByCorpus = (items) => {
    const grouped = {};
    items.forEach(item => {
      // Fallback: if corpus_name is missing, infer from context (likely subhashita for old translations)
      let corpusName = item.corpus_name;
      if (!corpusName) {
        // If verse_number doesn't contain a dot (like "1.1"), it's likely subhashita
        const verseNumber = item.corpus_unit_id || item.verse_number || '';
        corpusName = verseNumber && !verseNumber.includes('.') ? 'subhashita' : 'unknown';
      }
      const categoryInfo = getCorpusCategory(corpusName);
      const categoryKey = categoryInfo.category;
      
      if (!grouped[categoryKey]) {
        grouped[categoryKey] = {};
      }
      
      if (!grouped[categoryKey][corpusName]) {
        grouped[categoryKey][corpusName] = {
          label: categoryInfo.label,
          items: []
        };
      }
      
      grouped[categoryKey][corpusName].items.push(item);
    });
    return grouped;
  };

  const toggleCategory = (categoryKey) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryKey)) {
        newSet.delete(categoryKey);
      } else {
        newSet.add(categoryKey);
      }
      return newSet;
    });
  };

  const toggleCorpus = (corpusKey) => {
    setExpandedCorpus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(corpusKey)) {
        newSet.delete(corpusKey);
      } else {
        newSet.add(corpusKey);
      }
      return newSet;
    });
  };

  const toggleChapter = (chapterKey) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterKey)) {
        newSet.delete(chapterKey);
      } else {
        newSet.add(chapterKey);
      }
      return newSet;
    });
  };

  // Initialize all sections as expanded when data loads
  useEffect(() => {
    const items = activeTab === 'notes' ? notes : activeTab === 'favorites' ? favorites : translations;
    if (items.length > 0) {
      const allCategories = new Set();
      const allCorpus = new Set();
      const allChapters = new Set();
      
      if (activeTab === 'translations') {
        // For translations, use the new grouping function
        const grouped = groupTranslationsByCorpusAndChapter(items);
        Object.keys(grouped).forEach(corpusName => {
          allCorpus.add(corpusName);
          Object.keys(grouped[corpusName].chapters).forEach(chapterNumber => {
            allChapters.add(`${corpusName}-${chapterNumber}`);
          });
        });
      } else {
        // For notes and favorites, use the old grouping function
        const grouped = groupByCorpus(items);
        Object.keys(grouped).forEach(categoryKey => {
          allCategories.add(categoryKey);
          Object.keys(grouped[categoryKey]).forEach(corpusName => {
            allCorpus.add(`${categoryKey}-${corpusName}`);
          });
        });
      }
      
      setExpandedCategories(allCategories);
      setExpandedCorpus(allCorpus);
      setExpandedChapters(allChapters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, favorites, translations, activeTab]);

  const getCorpusRoute = (corpusName, corpusUnitID) => {
    const routeMap = {
      'bhagavad_gita': `/sruti/bhagavad-gita`,
      'subhashita': `/subhashita/mahasubhasitasamgraha`,
      'ramayana': `/epics/ramayana`,
      'hitopadesa': `/katha/hitopadesa`,
      'pancatantra': `/katha/pancatantra`,
      'aditya_hridaya_stotra': `/stotras/aditya-hridaya`
    };
    return routeMap[corpusName] || '/';
  };

  const fetchVerseDetails = async (corpusName, verseNumber) => {
    if (!apiUrl || !corpusName || !verseNumber) return null;
    
    const cacheKey = `${corpusName}-${verseNumber}`;
    if (verseDetailsCache[cacheKey]) {
      return verseDetailsCache[cacheKey];
    }
    
    try {
      let verseData = null;
      
      if (corpusName === 'subhashita') {
        const response = await fetch(`${apiUrl}/subhashita/random?verse_number=${verseNumber}`);
        if (response.ok) {
          verseData = await response.json();
        }
      } else if (corpusName === 'bhagavad_gita') {
        // Extract chapter from verse_number (e.g., "1.1" -> chapter 1)
        const chapterMatch = verseNumber.match(/^(\d+)/);
        if (chapterMatch) {
          const chapter = chapterMatch[1];
          const response = await fetch(`${apiUrl}/v2/bhagavad_gita/verses?chapter=${chapter}`);
          if (response.ok) {
            const verses = await response.json();
            verseData = Array.isArray(verses) 
              ? verses.find(v => v.verse_number === verseNumber && v.type === 'original_verse')
              : null;
          }
        }
      } else if (corpusName === 'hitopadesa' || corpusName === 'pancatantra') {
        // For hitopadesa and pancatantra, we need to fetch by chapter
        // The verse_number might be in format like "1.1" or just a number
        const chapterMatch = verseNumber.match(/^(\d+)/);
        if (chapterMatch) {
          const chapter = chapterMatch[1];
          const response = await fetch(`${apiUrl}/v2/${corpusName}/verses?chapter=${chapter}`);
          if (response.ok) {
            const verses = await response.json();
            const verseArray = Array.isArray(verses) ? verses : (verses ? [verses] : []);
            verseData = verseArray.find(v => 
              (v.verse_number === verseNumber || v.prose_number === verseNumber) &&
              (v.type === 'verse' || v.type === 'prose' || v.type === 'original_verse')
            );
          }
        }
      } else if (corpusName === 'aditya_hridaya_stotra') {
        const response = await fetch(`${apiUrl}/v2/aditya_hridaya_stotra/verses`);
        if (response.ok) {
          const verses = await response.json();
          const verseArray = Array.isArray(verses) ? verses : (verses ? [verses] : []);
          verseData = verseArray.find(v => v.verse_number === verseNumber);
        }
      }
      
      if (verseData) {
        setVerseDetailsCache(prev => ({
          ...prev,
          [cacheKey]: verseData
        }));
        return verseData;
      }
    } catch (err) {
      console.error(`Error fetching verse details for ${corpusName} ${verseNumber}:`, err);
    }
    
    return null;
  };

  // Fetch verse details for all items when data loads
  useEffect(() => {
    const fetchAllVerseDetails = async () => {
      const items = activeTab === 'notes' ? notes : activeTab === 'favorites' ? favorites : translations;
      
      const fetchPromises = items.map(async (item) => {
        // For notes and favorites, verse number is in corpus_unit_id
        // For translations, verse number is in verse_number
        const verseNumber = item.corpus_unit_id || item.verse_number;
        
        // Fallback: if corpus_name is missing, infer from context (likely subhashita for old translations)
        let corpusName = item.corpus_name;
        if (!corpusName && verseNumber) {
          // If verse_number doesn't contain a dot (like "1.1"), it's likely subhashita
          corpusName = !verseNumber.includes('.') ? 'subhashita' : null;
        }
        
        if (corpusName && verseNumber) {
          await fetchVerseDetails(corpusName, verseNumber);
        }
      });
      
      await Promise.all(fetchPromises);
    };
    
    if ((notes.length > 0 || favorites.length > 0 || translations.length > 0) && apiUrl) {
      fetchAllVerseDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, favorites, translations, activeTab, apiUrl]);

  if (!user || !token) {
    return (
      <>
        <div className="user-dashboard-container">
          <div className="user-dashboard-card">
            <h2>My Content</h2>
            <p>Please sign in to view your notes, favorites, and translations.</p>
          </div>
        </div>
        {showSignInModal && (
          <SignInModal
            onClose={() => setShowSignInModal(false)}
            onSignInSuccess={handleSignInSuccess}
            apiUrl={apiUrl}
          />
        )}
      </>
    );
  }

  return (
    <div className="user-dashboard-container">
      <div className="user-dashboard-card">
        <h2 className="user-dashboard-title">My Content</h2>
        
        {/* Tab Navigation */}
        <div className="user-dashboard-tabs">
          <button
            className={`user-dashboard-tab ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            Notes
          </button>
          <button
            className={`user-dashboard-tab ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            Favorites
          </button>
          <button
            className={`user-dashboard-tab ${activeTab === 'translations' ? 'active' : ''}`}
            onClick={() => setActiveTab('translations')}
          >
            Translations
          </button>
        </div>

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="user-dashboard-tab-content">
            {isLoadingNotes ? (
              <div className="user-dashboard-loading">Loading notes...</div>
            ) : notesError ? (
              <div className="user-dashboard-error">{notesError}</div>
            ) : notes.length === 0 ? (
              <div className="user-dashboard-empty">No notes yet. Start adding notes to verses you're studying!</div>
            ) : (
              (() => {
                const grouped = groupByCorpus(notes);
                return Object.keys(grouped).map(category => {
                  const isCategoryExpanded = expandedCategories.has(category);
                  return (
                    <div key={category} className="user-dashboard-category">
                      <h3 
                        className="user-dashboard-category-title user-dashboard-collapsible"
                        onClick={() => toggleCategory(category)}
                      >
                        <span className="user-dashboard-collapse-icon">{isCategoryExpanded ? '▼' : '▶'}</span>
                        {category}
                      </h3>
                      {isCategoryExpanded && Object.keys(grouped[category]).map(corpusName => {
                        const corpusKey = `${category}-${corpusName}`;
                        const isCorpusExpanded = expandedCorpus.has(corpusKey);
                        return (
                          <div key={corpusName} className="user-dashboard-corpus-section">
                            <h4 
                              className="user-dashboard-corpus-title user-dashboard-collapsible"
                              onClick={() => toggleCorpus(corpusKey)}
                            >
                              <span className="user-dashboard-collapse-icon">{isCorpusExpanded ? '▼' : '▶'}</span>
                              {grouped[category][corpusName].label}
                              <span className="user-dashboard-item-count"> ({grouped[category][corpusName].items.length})</span>
                            </h4>
                            {isCorpusExpanded && (
                              <div className="user-dashboard-items">
                                {grouped[category][corpusName].items.map((note) => {
                                  const verseKey = `${note.corpus_name}-${note.corpus_unit_id}`;
                                  const verseData = verseDetailsCache[verseKey];
                                  return (
                                    <div key={note.id || note._id} className="user-dashboard-item">
                                      {verseData && (
                                        <div className="user-dashboard-verse-context">
                                          <div className="user-dashboard-verse-original">
                                            <strong>Original Verse:</strong>
                                            <div className="user-dashboard-devanagari">
                                              {verseData.transliterated_devanagari || verseData.devanagari || verseData.text}
                                            </div>
                                          </div>
                                          {verseData.full_translation && (
                                            <div className="user-dashboard-verse-translation">
                                              <strong>Translation:</strong>
                                              <div>{verseData.full_translation}</div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      <div className="user-dashboard-item-header">
                                        <span className="user-dashboard-item-id">{note.corpus_unit}: {note.corpus_unit_id}</span>
                                      </div>
                                      <div className="user-dashboard-item-content">
                                        <strong>Your Note:</strong>
                                        <div style={{ marginTop: '0.5rem' }}>{note.content}</div>
                                      </div>
                                      <div className="user-dashboard-item-footer">
                                        {formatDate(note.created_at)}
                                        {note.updated_at && note.updated_at !== note.created_at && (
                                          <span> (updated {formatDate(note.updated_at)})</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}

        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          <div className="user-dashboard-tab-content">
            {isLoadingFavorites ? (
              <div className="user-dashboard-loading">Loading favorites...</div>
            ) : favoritesError ? (
              <div className="user-dashboard-error">{favoritesError}</div>
            ) : favorites.length === 0 ? (
              <div className="user-dashboard-empty">No favorites yet. Star verses you want to revisit!</div>
            ) : (
              (() => {
                const grouped = groupByCorpus(favorites);
                return Object.keys(grouped).map(category => {
                  const isCategoryExpanded = expandedCategories.has(category);
                  return (
                    <div key={category} className="user-dashboard-category">
                      <h3 
                        className="user-dashboard-category-title user-dashboard-collapsible"
                        onClick={() => toggleCategory(category)}
                      >
                        <span className="user-dashboard-collapse-icon">{isCategoryExpanded ? '▼' : '▶'}</span>
                        {category}
                      </h3>
                      {isCategoryExpanded && Object.keys(grouped[category]).map(corpusName => {
                        const corpusKey = `${category}-${corpusName}`;
                        const isCorpusExpanded = expandedCorpus.has(corpusKey);
                        return (
                          <div key={corpusName} className="user-dashboard-corpus-section">
                            <h4 
                              className="user-dashboard-corpus-title user-dashboard-collapsible"
                              onClick={() => toggleCorpus(corpusKey)}
                            >
                              <span className="user-dashboard-collapse-icon">{isCorpusExpanded ? '▼' : '▶'}</span>
                              {grouped[category][corpusName].label}
                              <span className="user-dashboard-item-count"> ({grouped[category][corpusName].items.length})</span>
                            </h4>
                            {isCorpusExpanded && (
                              <div className="user-dashboard-items">
                                {grouped[category][corpusName].items.map((favorite) => {
                                  const verseKey = `${favorite.corpus_name}-${favorite.corpus_unit_id}`;
                                  const verseData = verseDetailsCache[verseKey];
                                  return (
                                    <div key={favorite.id || favorite._id} className="user-dashboard-item">
                                      {verseData && (
                                        <div className="user-dashboard-verse-context">
                                          <div className="user-dashboard-verse-original">
                                            <strong>Original Verse:</strong>
                                            <div className="user-dashboard-devanagari">
                                              {verseData.transliterated_devanagari || verseData.devanagari || verseData.text}
                                            </div>
                                          </div>
                                          {verseData.full_translation && (
                                            <div className="user-dashboard-verse-translation">
                                              <strong>Translation:</strong>
                                              <div>{verseData.full_translation}</div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      <div className="user-dashboard-item-header">
                                        <span className="user-dashboard-item-id">{favorite.corpus_unit}: {favorite.corpus_unit_id}</span>
                                      </div>
                                      <div className="user-dashboard-item-footer">
                                        Favorited on {formatDate(favorite.created_at)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}

        {/* Translations Tab */}
        {activeTab === 'translations' && (
          <div className="user-dashboard-tab-content">
            {isLoadingTranslations ? (
              <div className="user-dashboard-loading">Loading translations...</div>
            ) : translationsError ? (
              <div className="user-dashboard-error">{translationsError}</div>
            ) : translations.length === 0 ? (
              <div className="user-dashboard-empty">No translations yet. Practice translating verses to see them here!</div>
            ) : (
              (() => {
                const grouped = groupTranslationsByCorpusAndChapter(translations);
                // Sort corpus names for consistent display
                const sortedCorpusNames = Object.keys(grouped).sort();
                
                return sortedCorpusNames.map(corpusName => {
                  const isCorpusExpanded = expandedCorpus.has(corpusName);
                  const corpusData = grouped[corpusName];
                  // Sort chapter numbers numerically
                  const sortedChapterNumbers = Object.keys(corpusData.chapters).sort((a, b) => {
                    const numA = parseInt(a, 10) || 0;
                    const numB = parseInt(b, 10) || 0;
                    return numA - numB;
                  });
                  
                  // Calculate total translations count
                  const totalCount = Object.values(corpusData.chapters).reduce((sum, verses) => sum + verses.length, 0);
                  
                  return (
                    <div key={corpusName} className="user-dashboard-corpus-section">
                      <h3 
                        className="user-dashboard-corpus-title user-dashboard-collapsible"
                        onClick={() => toggleCorpus(corpusName)}
                      >
                        <span className="user-dashboard-collapse-icon">{isCorpusExpanded ? '▼' : '▶'}</span>
                        {corpusData.label}
                        <span className="user-dashboard-item-count"> ({totalCount})</span>
                      </h3>
                      {isCorpusExpanded && sortedChapterNumbers.map(chapterNumber => {
                        const chapterKey = `${corpusName}-${chapterNumber}`;
                        const isChapterExpanded = expandedChapters.has(chapterKey);
                        const verses = corpusData.chapters[chapterNumber];
                        const chapterLabel = chapterNumber === '0' && corpusName === 'subhashita' 
                          ? 'All Verses' 
                          : `Chapter ${chapterNumber}`;
                        
                        return (
                          <div key={chapterNumber} className="user-dashboard-corpus-section" style={{ marginLeft: '1rem' }}>
                            <h4 
                              className="user-dashboard-corpus-title user-dashboard-collapsible"
                              onClick={() => toggleChapter(chapterKey)}
                            >
                              <span className="user-dashboard-collapse-icon">{isChapterExpanded ? '▼' : '▶'}</span>
                              {chapterLabel}
                              <span className="user-dashboard-item-count"> ({verses.length})</span>
                            </h4>
                            {isChapterExpanded && (
                              <div className="user-dashboard-items">
                                {verses.map((translation) => {
                                  const inferredCorpusName = translation.corpus_name || corpusName;
                                  const verseKey = `${inferredCorpusName}-${translation.verse_number}`;
                                  const verseData = verseDetailsCache[verseKey];
                                  return (
                                    <div key={translation.id || translation._id} className="user-dashboard-item">
                                      {verseData && (
                                        <div className="user-dashboard-verse-context">
                                          <div className="user-dashboard-verse-original">
                                            <strong>Original Verse:</strong>
                                            <div className="user-dashboard-devanagari">
                                              {verseData.transliterated_devanagari || verseData.devanagari || verseData.text}
                                            </div>
                                          </div>
                                          {verseData.full_translation && (
                                            <div className="user-dashboard-verse-translation">
                                              <strong>AI Translation:</strong>
                                              <div>{verseData.full_translation}</div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      <div className="user-dashboard-item-header">
                                        <span className="user-dashboard-item-id">Verse: {translation.verse_number}</span>
                                      </div>
                                      <div className="user-dashboard-item-content">
                                        <strong>Your Translation:</strong>
                                        <div style={{ marginTop: '0.5rem' }}>{translation.translation}</div>
                                      </div>
                                      {translation.evaluation_result && (
                                        <div className="user-dashboard-evaluation">
                                          <div><strong>Language Mastery:</strong> {translation.evaluation_result.language_mastery || 'N/A'}</div>
                                          <div><strong>Translation Fidelity:</strong> {translation.evaluation_result.translation_fidelity || 'N/A'}</div>
                                          <div><strong>Nuance:</strong> {translation.evaluation_result.nuance || 'N/A'}</div>
                                        </div>
                                      )}
                                      <div className="user-dashboard-item-footer">
                                        {formatDate(translation.created_at)}
                                        {translation.updated_at && translation.updated_at !== translation.created_at && (
                                          <span> (updated {formatDate(translation.updated_at)})</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;

