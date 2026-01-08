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

  const groupByCorpus = (items) => {
    const grouped = {};
    items.forEach(item => {
      const corpusName = item.corpus_name || 'unknown';
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

  // Initialize all sections as expanded when data loads
  useEffect(() => {
    const items = activeTab === 'notes' ? notes : activeTab === 'favorites' ? favorites : translations;
    if (items.length > 0) {
      const allCategories = new Set();
      const allCorpus = new Set();
      
      const grouped = groupByCorpus(items);
      
      Object.keys(grouped).forEach(categoryKey => {
        allCategories.add(categoryKey);
        Object.keys(grouped[categoryKey]).forEach(corpusName => {
          allCorpus.add(`${categoryKey}-${corpusName}`);
        });
      });
      
      setExpandedCategories(allCategories);
      setExpandedCorpus(allCorpus);
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
                                {grouped[category][corpusName].items.map((note) => (
                                  <div key={note.id || note._id} className="user-dashboard-item">
                                    <div className="user-dashboard-item-header">
                                      <span className="user-dashboard-item-id">{note.corpus_unit}: {note.corpus_unit_id}</span>
                                    </div>
                                    <div className="user-dashboard-item-content">{note.content}</div>
                                    <div className="user-dashboard-item-footer">
                                      {formatDate(note.created_at)}
                                      {note.updated_at && note.updated_at !== note.created_at && (
                                        <span> (updated {formatDate(note.updated_at)})</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
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
                                {grouped[category][corpusName].items.map((favorite) => (
                                  <div key={favorite.id || favorite._id} className="user-dashboard-item">
                                    <div className="user-dashboard-item-header">
                                      <span className="user-dashboard-item-id">{favorite.corpus_unit}: {favorite.corpus_unit_id}</span>
                                    </div>
                                    <div className="user-dashboard-item-footer">
                                      Favorited on {formatDate(favorite.created_at)}
                                    </div>
                                  </div>
                                ))}
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
                const grouped = groupByCorpus(translations);
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
                                {grouped[category][corpusName].items.map((translation) => (
                                  <div key={translation.id || translation._id} className="user-dashboard-item">
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
                                ))}
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

