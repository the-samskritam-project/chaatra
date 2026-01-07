import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DictionaryLookup from '../dictionary/DictionaryLookup';
import SignInModal from '../auth/SignInModal';
import './Subhashita.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';

function Subhashita({ user, token, onSignInSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();
  const showBackButton = location.pathname.startsWith('/subhashita/');
  
  const [apiUrl, setApiUrl] = useState('');
  const [verse, setVerse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // New state for splits and word-by-word translation
  const [showSplits, setShowSplits] = useState(false);
  const [showWordByWord, setShowWordByWord] = useState(false);
  const [splits, setSplits] = useState(null);
  const [isLoadingSplits, setIsLoadingSplits] = useState(false);
  
  // State for user translation
  const [userTranslation, setUserTranslation] = useState('');
  const [savedTranslation, setSavedTranslation] = useState(null);
  const [isSavingTranslation, setIsSavingTranslation] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('random');
  
  // State for "My Translations" tab
  const [allTranslations, setAllTranslations] = useState([]);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);

  const requireSignIn = () => {
    setShowSignInModal(true);
  };

  const handleSignInSuccessInternal = (result) => {
    if (onSignInSuccess) {
      onSignInSuccess(result);
    }
    setShowSignInModal(false);
  };

  useEffect(() => {
    const url = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';
    setApiUrl(url);
    fetchRandomVerse();
  }, []);

  const fetchVerse = async (verseNumber = null, skipLoadTranslation = false) => {
    if (!apiUrl) return;
    setIsLoading(true);
    setError(null);
    setShowSplits(false);
    setShowWordByWord(false);
    setSplits(null);
    if (!skipLoadTranslation) {
      setUserTranslation('');
      setSavedTranslation(null);
    }
    setVerificationResult(null);
    try {
      const url = verseNumber 
        ? `${apiUrl}/subhashita/random?verse_number=${verseNumber}`
        : `${apiUrl}/subhashita/random`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
      }
      const data = await response.json();
      setVerse(data);
      
      // Check if verse already has splits
      if (data.split_shloka && data.split_word_by_word_translation && data.split_word_by_word_translation.length > 0) {
        setSplits({
          uncompounded_shloka: data.split_shloka,
          word_by_word_translation: data.split_word_by_word_translation
        });
      }
      
      // Load saved translation if user is logged in and we're not skipping it
      if (!skipLoadTranslation) {
        if (user && token && data.verse_number) {
          await loadSavedTranslation(data.verse_number);
        } else {
          // Clear translation if user is not logged in
          setUserTranslation('');
          setSavedTranslation(null);
        }
      }
    } catch (err) {
      console.error('Subhashita fetch error:', err);
      setError('Unable to fetch subhashita. Please try again.');
      setVerse(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRandomVerse = async () => {
    await fetchVerse();
  };

  const handleEditTranslation = async (translationItem) => {
    // Switch to random tab
    setActiveTab('random');
    
    // Clear states first
    setUserTranslation('');
    setSavedTranslation(null);
    setVerificationResult(null);
    
    // Fetch the specific verse (skip auto-loading translation since we'll set it manually)
    setIsLoading(true);
    setError(null);
    
    try {
      const url = `${apiUrl}/subhashita/random?verse_number=${translationItem.verse_number}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
      }
      const data = await response.json();
      
      // Verify we got the correct verse
      if (data.verse_number !== translationItem.verse_number) {
        console.error('Verse number mismatch:', data.verse_number, 'expected:', translationItem.verse_number);
        setError('Failed to load the correct verse. Please try again.');
        return;
      }
      
      setVerse(data);
      
      // Check if verse already has splits
      if (data.split_shloka && data.split_word_by_word_translation && data.split_word_by_word_translation.length > 0) {
        setSplits({
          uncompounded_shloka: data.split_shloka,
          word_by_word_translation: data.split_word_by_word_translation
        });
      }
      
      // Set the saved translation
      setUserTranslation(translationItem.translation);
      setSavedTranslation(translationItem);
    } catch (err) {
      console.error('Error loading verse for editing:', err);
      setError('Unable to load verse. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedTranslation = async (verseNumber) => {
    if (!apiUrl || !user || !token) return;
    
    try {
      const response = await fetch(`${apiUrl}/subhashita/${verseNumber}/translation`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404 || response.status === 401) {
          // No translation found or not authorized
          setSavedTranslation(null);
          return;
        }
        throw new Error(`Failed to fetch saved translation: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data) {
        setSavedTranslation(data);
        setUserTranslation(data.translation);
      } else {
        setSavedTranslation(null);
      }
    } catch (err) {
      console.error('Error loading saved translation:', err);
      setSavedTranslation(null);
    }
  };

  const fetchSplits = async () => {
    if (!apiUrl || !verse || !verse.verse_number) return;
    
    setIsLoadingSplits(true);
    try {
      const response = await fetch(`${apiUrl}/subhashita/${verse.verse_number}/split`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch splits: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSplits(data);
      setShowSplits(true);
    } catch (err) {
      console.error('Error fetching splits:', err);
      setError('Unable to fetch word splits. Please try again.');
    } finally {
      setIsLoadingSplits(false);
    }
  };

  const handleViewSplits = () => {
    if (splits) {
      setShowSplits(true);
    } else {
      fetchSplits();
    }
  };

  const handleViewWordByWord = () => {
    if (!splits) {
      handleViewSplits();
    }
    setShowWordByWord(true);
  };

  const handleSaveTranslation = async () => {
    if (!user || !token) {
      // Require sign-in before saving
      requireSignIn();
      return;
    }
    
    if (!userTranslation.trim()) {
      setError('Please enter a translation before saving.');
      return;
    }
    
    if (!verse || !verse.verse_number) {
      setError('No verse selected.');
      return;
    }
    
    setIsSavingTranslation(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/subhashita/${verse.verse_number}/translation`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_translation: userTranslation.trim(),
        }),
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please sign in to save translations.');
          requireSignIn();
          return;
        }
        throw new Error(`Failed to save translation: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSavedTranslation(data);
      setError(null);
    } catch (err) {
      console.error('Error saving translation:', err);
      setError('Unable to save translation. Please try again.');
    } finally {
      setIsSavingTranslation(false);
    }
  };

  const fetchAllTranslations = async () => {
    if (!apiUrl || !user || !token) {
      // Require sign-in before loading translations
      requireSignIn();
      return;
    }
    
    setIsLoadingTranslations(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/subhashita/translations`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please sign in to view your translations.');
          requireSignIn();
          return;
        }
        throw new Error(`Failed to fetch translations: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAllTranslations(data || []);
    } catch (err) {
      console.error('Error fetching translations:', err);
      setError('Unable to fetch translations. Please try again.');
    } finally {
      setIsLoadingTranslations(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'translations' && user && token) {
      fetchAllTranslations();
    }
  }, [activeTab, user, token]);

  const handleVerifyTranslation = async () => {
    if (!verse || !verse.verse_number) {
      setError('No verse selected.');
      return;
    }
    
    setIsVerifying(true);
    setError(null);
    setVerificationResult(null);
    
    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Include Authorization header if user is logged in (for saving suggestions)
      if (user && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${apiUrl}/subhashita/${verse.verse_number}/verify`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          user_translation: userTranslation.trim(),
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to verify translation: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if this is a generated translation (when user translation was empty)
      if (data.generated_translation) {
        setUserTranslation(data.generated_translation);
        setError(null);
      } else {
        // This is a verification result
        setVerificationResult(data);
      }
    } catch (err) {
      console.error('Error verifying translation:', err);
      setError('Unable to verify translation. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="subhashita-container">
      <DictionaryLookup apiUrl={apiUrl} />
      {showBackButton && (
        <button
          onClick={() => navigate('/subhashita')}
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: '#666'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e0e0e0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f5f5f5';
          }}
        >
          ← Back to Subhashita
        </button>
      )}
      
      <div className="subhashita-card">
        {/* Tab Navigation */}
        <div className="subhashita-tabs">
          <button
            className={`subhashita-tab ${activeTab === 'random' ? 'active' : ''}`}
            onClick={() => setActiveTab('random')}
          >
            Get a Random Subhashita
          </button>
          <button
            className={`subhashita-tab ${activeTab === 'translations' ? 'active' : ''}`}
            onClick={() => setActiveTab('translations')}
          >
            My Translations
          </button>
        </div>
        
        {activeTab === 'random' && (
          <div className="subhashita-tab-content">
            <div className="subhashita-header">
              <h2>महासुभाषितसंग्रहः | Mahasubhashitasangraha</h2>
              <p className="subhashita-description">
                Discover random verses from the great collection of subhashitas.
              </p>
            </div>

            <button
              type="button"
              className="subhashita-button"
              onClick={fetchRandomVerse}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Get Random Subhashita'}
            </button>

            {error && <div className="subhashita-error">{error}</div>}

            {isLoading && !verse && (
              <div className="subhashita-loading">Loading a random subhashita...</div>
            )}

            {verse && (
              <div className="subhashita-result">
                <div className="subhashita-meta">
                  <span>Verse {verse.verse_number}</span>
                </div>
                {verse.transliterated_devanagari && (
                  <div className="subhashita-devanagari">
                    {verse.transliterated_devanagari.split('\n').map((line, index) => (
                      <div key={index} className="subhashita-line">
                        {line}
                      </div>
                    ))}
                  </div>
                )}
                {verse.full_translation && (
                  <div className="subhashita-translation">
                    {verse.full_translation}
                  </div>
                )}
                
                {/* Learning aids section */}
                <div className="subhashita-learning-aids">
                  <div className="subhashita-buttons-row">
                    {!showSplits && (
                      <button
                        type="button"
                        className="subhashita-action-button"
                        onClick={handleViewSplits}
                        disabled={isLoadingSplits}
                      >
                        {isLoadingSplits ? 'Loading...' : 'View Word Splits'}
                      </button>
                    )}
                    {splits && !showWordByWord && (
                      <button
                        type="button"
                        className="subhashita-action-button"
                        onClick={handleViewWordByWord}
                      >
                        View Word-by-Word Translation
                      </button>
                    )}
                  </div>
                  
                  {showSplits && splits && (
                    <div className="subhashita-splits-section">
                      <h3 className="subhashita-section-title">Uncompounded Shloka</h3>
                      <div className="subhashita-splits">
                        {splits.uncompounded_shloka.split('\n').map((line, index) => (
                          <div key={index} className="subhashita-line">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {showWordByWord && splits && splits.word_by_word_translation && (
                    <div className="subhashita-word-by-word-section">
                      <h3 className="subhashita-section-title">Word-by-Word Translation</h3>
                      <div className="subhashita-word-by-word">
                        {splits.word_by_word_translation.map((item, index) => (
                          <div key={index} className="subhashita-word-item">
                            <span className="subhashita-word">{item.word}</span>
                            <span className="subhashita-word-separator">→</span>
                            <span className="subhashita-word-translation">{item.translation}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* User translation section */}
                <div className="subhashita-user-translation-section">
                  <h3 className="subhashita-section-title">Your Translation</h3>
                  
                  {savedTranslation && (
                    <div className="subhashita-saved-translation-info">
                      <strong>✓ Saved translation loaded</strong>
                      <span className="subhashita-saved-time">
                        {savedTranslation.updated_at ? 
                          `Last updated: ${new Date(savedTranslation.updated_at).toLocaleDateString()}` :
                          savedTranslation.created_at ?
                          `Saved: ${new Date(savedTranslation.created_at).toLocaleDateString()}` :
                          ''
                        }
                      </span>
                    </div>
                  )}
                  
                  <textarea
                    className="subhashita-translation-input"
                    value={userTranslation}
                    onChange={(e) => setUserTranslation(e.target.value)}
                    placeholder="Enter your translation here, or click 'Get Translation' to generate one with AI..."
                    rows={4}
                  />
                  <div className="subhashita-translation-buttons">
                    <button
                      type="button"
                      className="subhashita-action-button"
                      onClick={handleVerifyTranslation}
                      disabled={isVerifying}
                    >
                      {isVerifying ? 
                        (userTranslation.trim() ? 'Verifying...' : 'Generating...') :
                        (userTranslation.trim() ? 'Verify Translation' : 'Get Translation')
                      }
                    </button>
                    <button
                      type="button"
                      className="subhashita-action-button subhashita-save-button"
                      onClick={handleSaveTranslation}
                      disabled={isSavingTranslation || !userTranslation.trim()}
                    >
                      {isSavingTranslation ? 'Saving...' : 'Save Translation'}
                    </button>
                  </div>
                  
                  {verificationResult && (
                    <div className={`subhashita-verification-result ${verificationResult.is_accurate ? 'accurate' : 'needs-improvement'}`}>
                      <div className="subhashita-verification-header">
                        <span className="subhashita-verification-status">
                          {verificationResult.is_accurate ? '✓ Good work!' : '💡 Learning tips'}
                        </span>
                      </div>
                      <div className="subhashita-verification-feedback">
                        {verificationResult.feedback}
                      </div>
                      {verificationResult.suggestions && verificationResult.suggestions.length > 0 && (
                        <div className="subhashita-verification-suggestions">
                          <strong>Suggestions:</strong>
                          <ul>
                            {verificationResult.suggestions.map((suggestion, index) => (
                              <li key={index}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {savedTranslation && !verificationResult && (
                    <div className="subhashita-saved-translation">
                      <strong>✓ Translation saved!</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'translations' && (
          <div className="subhashita-tab-content">
            <div className="subhashita-header">
              <h2>My Translations</h2>
              <p className="subhashita-description">
                View all your saved subhashita translations.
              </p>
            </div>
            
            {!user || !token ? (
              <div className="subhashita-auth-prompt">
                <p>Please sign in to view your translations.</p>
                <button
                  type="button"
                  className="subhashita-action-button"
                  onClick={requireSignIn}
                >
                  Sign In
                </button>
              </div>
            ) : (
              <>
                {isLoadingTranslations ? (
                  <div className="subhashita-loading">Loading your translations...</div>
                ) : allTranslations.length === 0 ? (
                  <div className="subhashita-empty-state">
                    <p>You haven't saved any translations yet.</p>
                    <p>Go to "Get a Random Subhashita" to start translating!</p>
                  </div>
                ) : (
                  <div className="subhashita-translations-list">
                    {allTranslations.map((item, index) => (
                      <div key={index} className="subhashita-translation-item">
                        <div className="subhashita-translation-item-header">
                          <h3>Verse {item.verse_number}</h3>
                          <div className="subhashita-translation-item-header-right">
                            <span className="subhashita-translation-item-date">
                              {item.updated_at ? 
                                `Updated: ${new Date(item.updated_at).toLocaleDateString()}` :
                                `Saved: ${new Date(item.created_at).toLocaleDateString()}`
                              }
                            </span>
                            <button
                              type="button"
                              className="subhashita-edit-button"
                              onClick={() => handleEditTranslation(item)}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                        
                        {item.verse && item.verse.transliterated_devanagari && (
                          <div className="subhashita-translation-item-devanagari">
                            {item.verse.transliterated_devanagari.split('\n').map((line, idx) => (
                              <div key={idx} className="subhashita-line">{line}</div>
                            ))}
                          </div>
                        )}
                        
                        <div className="subhashita-translation-item-translation">
                          <strong>Your Translation:</strong>
                          <p>{item.translation}</p>
                        </div>
                        
                        {item.ai_suggestions && item.ai_suggestions.length > 0 && (
                          <div className="subhashita-translation-item-suggestions">
                            <strong>AI Suggestions:</strong>
                            <ul>
                              {item.ai_suggestions.map((suggestion, idx) => (
                                <li key={idx}>{suggestion}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Sign In Modal */}
      {showSignInModal && (
        <SignInModal
          onClose={() => setShowSignInModal(false)}
          onSignInSuccess={handleSignInSuccessInternal}
          apiUrl={apiUrl}
        />
      )}
    </div>
  );
}

export default Subhashita;

