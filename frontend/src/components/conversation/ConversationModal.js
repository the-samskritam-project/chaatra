import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ConversationService from '../../services/ConversationService';
import WordTile from './WordTile';
import './ConversationModal.css';

const ConversationModal = ({ verse, corpusName, isOpen, onClose, apiUrl }) => {
  const [verseData, setVerseData] = useState(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [userTranslation, setUserTranslation] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState({
    revealed: {
      revealed_uncompounded_indices: [],
      revealed_word_indices: [],
      full_translation: false,
    },
  });
  const translationInputRef = useRef(null);

  const conversationService = new ConversationService(apiUrl);

  // Focus translation input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        translationInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Fetch verse data when modal opens
  useEffect(() => {
    if (isOpen && verse) {
      // Store verse data for displaying revealed words
      setVerseData(verse);
    } else if (!isOpen) {
      setVerseData(null);
    }
  }, [isOpen, verse]);

  // Split devanagari text into two lines (similar to CorpusVerse logic)
  const splitDevanagariLines = (text) => {
    if (!text) return [];
    
    const isVerse = verse?.type === 'original_verse' || verse?.type === 'verse';
    
    if (corpusName === 'bhagavad_gita' && isVerse) {
      const hasNewlines = text.includes('\n');
      const hasPipe = text.includes('|');
      const hasDanda = text.includes('।') || text.includes('॥');
      
      if (hasNewlines) {
        const lines = text.split('\n')
          .map(p => p.replace(/\|\|?$/, '').replace(/^\|/, '').replace(/[।॥]+$/, '').trim())
          .filter(p => p && p.length > 0);
        return lines.length > 0 ? lines : [text.trim()];
      }
      
      if (hasDanda) {
        let cleanText = text.replace(/\n/g, ' ');
        const parts = cleanText.split(/(।)/);
        const result = [];
        let current = '';
        
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === '।') {
            current += '।';
            if (current.trim()) {
              result.push(current.trim());
              current = '';
            }
          } else if (parts[i].trim()) {
            current += parts[i];
          }
        }
        
        if (current.trim()) {
          result.push(current.trim());
        }
        
        if (result.length >= 2) {
          return result;
        }
      }
      
      if (hasPipe) {
        let cleanText = text.replace(/\|\|$/, '').trim().replace(/\n/g, ' ');
        const parts = cleanText.split('|')
          .map(p => p.trim())
          .filter(p => p && p.length > 0);
        
        if (parts.length >= 2) {
          return parts;
        }
      }
      
      return [text.replace(/[।॥]+$/, '').replace(/\|\|?$/, '').trim()];
    }
    
    return text.split('\n').filter((line) => line.trim());
  };

  // Parse words from shloka and map them to lines
  const parseWordsToLines = () => {
    if (!verseData) return { line1: [], line2: [], allWords: [], line1WithDandas: [], line2WithDandas: [] };
    
    const shlokaText = verseData.transliterated_devanagari || verseData.devanagari || '';
    const lines = splitDevanagariLines(shlokaText);
    
    // Keep original lines with dandas for display
    const line1WithDandas = lines[0] || '';
    const line2WithDandas = lines[1] || '';
    
    // Parse words from each line - filter dandas for tiles but track original positions
    const line1AllWords = lines[0] ? lines[0].split(/\s+/).filter(w => w.trim()) : [];
    const line2AllWords = lines[1] ? lines[1].split(/\s+/).filter(w => w.trim()) : [];
    
    // Filter out dandas for word tiles, but track mapping to original positions
    const line1Words = [];
    const line2Words = [];
    const allWords = [];
    
    // Process line 1 - map filtered indices to original word positions
    let originalIndex = 0;
    line1AllWords.forEach((word, idx) => {
      if (!word.match(/^[।॥]+$/)) {
        // This is a real word, not just danda
        line1Words.push(word);
        allWords.push({ 
          word, 
          index: allWords.length, // This is the tile index (0-based, no dandas)
          originalIndex: originalIndex, // This is the index in the original shloka (with dandas)
          line: 0 
        });
      }
      originalIndex++;
    });
    
    // Process line 2
    originalIndex = line1AllWords.length; // Continue counting from line 1
    line2AllWords.forEach((word, idx) => {
      if (!word.match(/^[।॥]+$/)) {
        line2Words.push(word);
        allWords.push({ 
          word, 
          index: allWords.length, // Tile index
          originalIndex: originalIndex, // Original index
          line: 1 
        });
      }
      originalIndex++;
    });
    
    return { 
      line1: line1Words, 
      line2: line2Words, 
      allWords,
      line1WithDandas,
      line2WithDandas
    };
  };

  // Build mapping from original word indices to split word indices
  // This handles cases where one original word (compound) maps to multiple split words
  const buildWordMapping = () => {
    if (!verseData) return { originalToSplit: [], splitWords: [] };
    
    const originalShloka = verseData.transliterated_devanagari || verseData.devanagari || '';
    const splitShloka = verseData.split_shloka || '';
    
    if (!splitShloka) {
      return { originalToSplit: [], splitWords: [] };
    }
    
    // Get original words (filtered, no dandas)
    const originalWords = originalShloka.split(/\s+/).filter(w => w.trim() && !w.match(/^[।॥]+$/));
    // Get split words (filtered, no dandas)
    const splitWords = splitShloka.split(/\s+/).filter(w => w.trim() && !w.match(/^[।॥]+$/));
    
    // Build mapping: for each original word, find which split words it maps to
    // Strategy: match by reconstructing the original word from split words (removing spaces/joining)
    const originalToSplit = [];
    let splitIndex = 0;
    
    for (let origIdx = 0; origIdx < originalWords.length; origIdx++) {
      const originalWord = originalWords[origIdx];
      const splitIndices = [];
      
      // Try to match: concatenate split words until we match the original
      let reconstructed = '';
      
      while (splitIndex < splitWords.length) {
        const nextWord = splitWords[splitIndex];
        const testReconstruction = reconstructed + nextWord;
        
        // Remove any spaces/dandas from test reconstruction for comparison
        const testClean = testReconstruction.replace(/\s+/g, '').replace(/[।॥]/g, '');
        const originalClean = originalWord.replace(/\s+/g, '').replace(/[।॥]/g, '');
        
        // If we've exceeded the original length significantly, we've gone too far
        if (testClean.length > originalClean.length * 1.2) {
          break;
        }
        
        reconstructed = testReconstruction;
        splitIndices.push(splitIndex);
        splitIndex++;
        
        // If we've matched the length reasonably, check if we should stop
        // Allow some flexibility for sandhi changes (original might be slightly shorter/longer)
        if (testClean.length >= originalClean.length * 0.9) {
          // Check if adding next word would be too much
          if (splitIndex >= splitWords.length) {
            break;
          }
          const nextTest = (testReconstruction + splitWords[splitIndex]).replace(/\s+/g, '').replace(/[।॥]/g, '');
          if (nextTest.length > originalClean.length * 1.2) {
            break;
          }
        }
      }
      
      // If no split words matched, map to at least one (fallback - shouldn't happen normally)
      if (splitIndices.length === 0 && splitIndex < splitWords.length) {
        splitIndices.push(splitIndex);
        splitIndex++;
      }
      
      originalToSplit[origIdx] = splitIndices;
    }
    
    return { originalToSplit, splitWords };
  };

  // Get word data for a specific tile index
  // wordIndex is the tile index (filtered, no dandas) - corresponds to original word index
  const getWordData = (wordIndex) => {
    if (!verseData) return null;
    
    const { originalToSplit, splitWords } = buildWordMapping();
    const wordTranslations = verseData.split_word_by_word_translation || [];
    
    const isUncompoundedRevealed = state.revealed.revealed_uncompounded_indices.includes(wordIndex);
    const isMeaningRevealed = state.revealed.revealed_word_indices.includes(wordIndex);
    
    let uncompoundedParts = [];
    let meanings = [];
    
    if (isUncompoundedRevealed && wordIndex < originalToSplit.length) {
      // Get all split words that correspond to this original word
      const splitIndices = originalToSplit[wordIndex] || [];
      uncompoundedParts = splitIndices.map(idx => splitWords[idx]).filter(w => w);
      
      // If meaning is revealed, get meanings for all split parts
      if (isMeaningRevealed) {
        meanings = splitIndices.map(idx => {
          if (idx < wordTranslations.length) {
            return wordTranslations[idx]?.translation || '';
          }
          return '';
        }).filter(m => m);
      }
    }
    
    return {
      isUncompoundedRevealed,
      isMeaningRevealed,
      uncompoundedParts,
      meanings,
    };
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen && verse) {
      setState({
        revealed: {
          revealed_uncompounded_indices: [],
          revealed_word_indices: [],
          full_translation: false,
        },
      });
      setHintsUsed(0);
      setUserTranslation('');
      setEvaluation(null);
      setError('');
    } else if (!isOpen) {
      setState({
        revealed: {
          revealed_uncompounded_indices: [],
          revealed_word_indices: [],
          full_translation: false,
        },
      });
      setHintsUsed(0);
      setUserTranslation('');
      setEvaluation(null);
      setError('');
    }
  }, [isOpen, verse]);

  const handleClose = () => {
    if (!isEvaluating) {
      onClose();
    }
  };

  // Client-side hint revelation - no API calls
  const handleWordTileClick = (wordIndex) => {
    if (isEvaluating) return;
    
    const wordData = getWordData(wordIndex);
    
    // If uncompounded not revealed, reveal it
    if (!wordData?.isUncompoundedRevealed) {
      setState(prev => ({
        ...prev,
        revealed: {
          ...prev.revealed,
          revealed_uncompounded_indices: [...prev.revealed.revealed_uncompounded_indices, wordIndex],
        },
      }));
      setHintsUsed(prev => prev + 1);
    } 
    // If uncompounded revealed but meaning not, reveal meaning
    else if (!wordData?.isMeaningRevealed) {
      setState(prev => ({
        ...prev,
        revealed: {
          ...prev.revealed,
          revealed_word_indices: [...prev.revealed.revealed_word_indices, wordIndex],
        },
      }));
      setHintsUsed(prev => prev + 1);
    }
  };

  // Client-side full translation reveal
  const handleShowFullTranslation = () => {
    if (state.revealed.full_translation || isEvaluating) return;
    
    setState(prev => ({
      ...prev,
      revealed: {
        ...prev.revealed,
        full_translation: true,
      },
    }));
    setHintsUsed(prev => prev + 1);
  };

  // Handle translation submission
  const handleSubmitTranslation = async (e) => {
    e.preventDefault();
    
    if (!userTranslation.trim() || isEvaluating) {
      return;
    }

    setIsEvaluating(true);
    setError('');

    try {
      const hintsUsed = {
        revealed_uncompounded_indices: state.revealed.revealed_uncompounded_indices,
        revealed_word_indices: state.revealed.revealed_word_indices,
        full_translation_shown: state.revealed.full_translation,
      };

      const response = await conversationService.evaluateTranslation(
        corpusName,
        verse.verse_number || verse._id,
        userTranslation.trim(),
        hintsUsed
      );

      setEvaluation(response);
    } catch (err) {
      setError(err.message || 'Failed to evaluate translation. Please try again.');
      console.error('Error evaluating translation:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Handle try again
  const handleTryAgain = () => {
    setState({
      revealed: {
        revealed_uncompounded_indices: [],
        revealed_word_indices: [],
        full_translation: false,
      },
    });
    setHintsUsed(0);
    setUserTranslation('');
    setEvaluation(null);
    setError('');
  };

  if (!isOpen) {
    return null;
  }

  const { line1, line2, allWords, line1WithDandas, line2WithDandas } = parseWordsToLines();
  const getVerseNumber = () => {
    if (corpusName === 'bhagavad_gita' && verse?.verse_number) {
      const parts = verse.verse_number.split('.');
      if (parts.length === 2) {
        return `Bhagavad Gita ${parts[0]}.${parts[1]}`;
      }
      return `Bhagavad Gita ${verse.verse_number}`;
    }
    return verse?.verse_number || verse?._id || 'Verse';
  };

  return createPortal(
    <div className="modal-overlay conversation-modal-overlay" onClick={handleClose}>
      <div className="modal-content conversation-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="conversation-modal-header">
          <div className="conversation-header-left">
            <h2 className="conversation-modal-title">Sanskrit Translation Tutor</h2>
            <div className="conversation-header-meta">
              <div className="conversation-verse-number">{getVerseNumber()}</div>
              <div className="conversation-hint-counter">Hints used: {hintsUsed}</div>
            </div>
          </div>
          <div className="conversation-header-right">
            <button className="modal-close" onClick={handleClose} disabled={isEvaluating}>
              ×
            </button>
          </div>
        </div>

        <div className="conversation-modal-body">
          {/* Shloka Display in Two Lines - with dandas */}
          {verseData && (
            <div className="conversation-shloka-display-section">
              <div className="conversation-shloka-lines">
                {line1WithDandas && (
                  <div className="conversation-shloka-line">
                    {line1WithDandas}
                  </div>
                )}
                {line2WithDandas && (
                  <div className="conversation-shloka-line">
                    {line2WithDandas}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Word Tiles Grid - Maintaining Verse Layout */}
          <div className="conversation-word-tiles-section">
            <div className="conversation-word-tiles-container">
              {/* Line 1 Tiles */}
              {line1.length > 0 && (
                <div className="conversation-word-tiles-line">
                  {allWords.filter(w => w.line === 0).map((wordInfo) => {
                    const wordData = getWordData(wordInfo.index);
                    return (
                      <WordTile
                        key={wordInfo.index}
                        word={wordInfo.word}
                        index={wordInfo.index}
                        isUncompoundedRevealed={wordData?.isUncompoundedRevealed || false}
                        isMeaningRevealed={wordData?.isMeaningRevealed || false}
                        uncompoundedParts={wordData?.uncompoundedParts || []}
                        meanings={wordData?.meanings || []}
                        onClick={handleWordTileClick}
                        disabled={isEvaluating}
                      />
                    );
                  })}
                </div>
              )}
              
              {/* Line 2 Tiles */}
              {line2.length > 0 && (
                <div className="conversation-word-tiles-line">
                  {allWords.filter(w => w.line === 1).map((wordInfo) => {
                    const wordData = getWordData(wordInfo.index);
                    return (
                      <WordTile
                        key={wordInfo.index}
                        word={wordInfo.word}
                        index={wordInfo.index}
                        isUncompoundedRevealed={wordData?.isUncompoundedRevealed || false}
                        isMeaningRevealed={wordData?.isMeaningRevealed || false}
                        uncompoundedParts={wordData?.uncompoundedParts || []}
                        meanings={wordData?.meanings || []}
                        onClick={handleWordTileClick}
                        disabled={isEvaluating}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Full Translation Escape Hatch */}
          {!state.revealed.full_translation && !evaluation && (
            <div className="conversation-escape-hatch">
              <button
                className="conversation-full-translation-button"
                onClick={handleShowFullTranslation}
                disabled={isEvaluating}
              >
                Show Full Translation
              </button>
            </div>
          )}

          {/* Full Translation Display */}
          {state.revealed.full_translation && verseData?.full_translation && !evaluation && (
            <div className="conversation-full-translation-display">
              <h4 className="conversation-full-translation-title">Full Translation:</h4>
              <div className="conversation-full-translation-text">{verseData.full_translation}</div>
            </div>
          )}

          {/* Translation Input Section */}
          {!evaluation && (
            <div className="conversation-translation-input-section">
              <label htmlFor="translation-input" className="conversation-translation-label">
                Your Translation:
              </label>
              <textarea
                id="translation-input"
                ref={translationInputRef}
                value={userTranslation}
                onChange={(e) => setUserTranslation(e.target.value)}
                placeholder="Type your translation here..."
                disabled={isEvaluating}
                className="conversation-translation-textarea"
                rows="4"
              />
              <button
                type="button"
                onClick={handleSubmitTranslation}
                disabled={isEvaluating || !userTranslation.trim()}
                className="conversation-submit-button"
              >
                {isEvaluating ? 'Evaluating...' : 'Submit Translation'}
              </button>
            </div>
          )}

          {/* Evaluation Display */}
          {evaluation && (
            <div className="conversation-evaluation-section">
              <div className="conversation-evaluation-ratings">
                <div className="conversation-rating-item">
                  <div className="conversation-rating-label">Language Mastery</div>
                  <div className={`conversation-rating-value rating-${evaluation.language_mastery?.toLowerCase().replace(/\s+/g, '-') || 'fair'}`}>
                    {evaluation.language_mastery || 'Fair'}
                  </div>
                  <div className="conversation-rating-description">
                    Based on hints used and their necessity for difficult terms
                  </div>
                </div>
                
                <div className="conversation-rating-item">
                  <div className="conversation-rating-label">Translation Fidelity</div>
                  <div className={`conversation-rating-value rating-${evaluation.translation_fidelity?.toLowerCase().replace(/\s+/g, '-') || 'fair'}`}>
                    {evaluation.translation_fidelity || 'Fair'}
                  </div>
                  <div className="conversation-rating-description">
                    How closely the translation matches the canonical meaning
                  </div>
                </div>
                
                <div className="conversation-rating-item">
                  <div className="conversation-rating-label">Nuance</div>
                  <div className={`conversation-rating-value rating-${evaluation.nuance?.toLowerCase().replace(/\s+/g, '-') || 'fair'}`}>
                    {evaluation.nuance || 'Fair'}
                  </div>
                  <div className="conversation-rating-description">
                    Whether the translation captures nuanced ideas and philosophical depth
                  </div>
                </div>
              </div>
              
              <div className="conversation-evaluation-feedback">
                <h4 className="conversation-feedback-title">Feedback:</h4>
                <div className="conversation-feedback-text">{evaluation.feedback}</div>
              </div>

              {evaluation.strengths && evaluation.strengths.length > 0 && (
                <div className="conversation-evaluation-strengths">
                  <h4 className="conversation-strengths-title">Strengths:</h4>
                  <ul className="conversation-strengths-list">
                    {evaluation.strengths.map((strength, idx) => (
                      <li key={idx}>{strength}</li>
                    ))}
                  </ul>
                </div>
              )}

              {evaluation.areas_for_improvement && evaluation.areas_for_improvement.length > 0 && (
                <div className="conversation-evaluation-improvements">
                  <h4 className="conversation-improvements-title">Areas for Improvement:</h4>
                  <ul className="conversation-improvements-list">
                    {evaluation.areas_for_improvement.map((area, idx) => (
                      <li key={idx}>{area}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={handleTryAgain}
                className="conversation-try-again-button"
              >
                Try Again
              </button>
            </div>
          )}

          {error && (
            <div className="conversation-error">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConversationModal;

