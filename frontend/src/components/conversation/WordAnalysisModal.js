import React from 'react';
import { createPortal } from 'react-dom';
import './WordAnalysisModal.css';

// Helper function to detect if forms have noun structure (singular/dual/plural with cases)
const hasNounStructure = (forms) => {
  if (!forms || typeof forms !== 'object') return false;
  const keys = Object.keys(forms);
  // Check if it has singular, dual, or plural keys
  const hasNumberKeys = keys.some(key => ['singular', 'dual', 'plural'].includes(key.toLowerCase()));
  if (!hasNumberKeys) return false;
  // Check if any number has case keys
  for (const key of keys) {
    const numberForms = forms[key];
    if (numberForms && typeof numberForms === 'object') {
      const caseKeys = Object.keys(numberForms);
      const hasCases = caseKeys.some(caseKey => 
        ['nominative', 'accusative', 'instrumental', 'dative', 'ablative', 'genitive', 'locative', 'vocative'].includes(caseKey.toLowerCase())
      );
      if (hasCases) return true;
    }
  }
  return false;
};

// Helper function to detect if forms have verb structure (tenses with person/number)
const hasVerbStructure = (forms) => {
  if (!forms || typeof forms !== 'object') return false;
  const keys = Object.keys(forms);
  // Check if it has tense keys
  const hasTenseKeys = keys.some(key => 
    ['present', 'past', 'future', 'imperative', 'optative'].includes(key.toLowerCase())
  );
  if (!hasTenseKeys) return false;
  // Check if any tense has person/number keys
  for (const key of keys) {
    const tenseForms = forms[key];
    if (tenseForms && typeof tenseForms === 'object') {
      const formKeys = Object.keys(tenseForms);
      const hasPersonNumber = formKeys.some(formKey => 
        formKey.includes('person') && (formKey.includes('singular') || formKey.includes('dual') || formKey.includes('plural'))
      );
      if (hasPersonNumber) return true;
    }
  }
  return false;
};

const WordAnalysisModal = ({ word, analysis, isLoading, error, onClose, position }) => {
  const renderNounForms = (forms) => {
    if (!forms || typeof forms !== 'object') return null;

    const cases = [
      { key: 'nominative', label: 'Nominative (प्रथमा)' },
      { key: 'accusative', label: 'Accusative (द्वितीया)' },
      { key: 'instrumental', label: 'Instrumental (तृतीया)' },
      { key: 'dative', label: 'Dative (चतुर्थी)' },
      { key: 'ablative', label: 'Ablative (पञ्चमी)' },
      { key: 'genitive', label: 'Genitive (षष्ठी)' },
      { key: 'locative', label: 'Locative (सप्तमी)' },
      { key: 'vocative', label: 'Vocative (सम्बोधन)' },
    ];

    // Get available numbers from the forms object
    const allNumbers = ['singular', 'dual', 'plural'];
    const numbers = allNumbers.filter(num => forms[num] && typeof forms[num] === 'object');
    const numberLabels = { singular: 'Singular', dual: 'Dual', plural: 'Plural' };

    return (
      <div className="word-analysis-forms">
        <h4 className="word-analysis-forms-title">Vibhaktis (Cases)</h4>
        <div className="word-analysis-table-container">
          <table className="word-analysis-table">
            <thead>
              <tr>
                <th>Case</th>
                {numbers.map(num => (
                  <th key={num}>{numberLabels[num]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map(caseItem => (
                <tr key={caseItem.key}>
                  <td className="word-analysis-case-label">{caseItem.label}</td>
                  {numbers.map(num => {
                    const caseForms = forms[num];
                    const form = caseForms && caseForms[caseItem.key];
                    return (
                      <td key={num} className="word-analysis-form-cell">
                        {form || '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderVerbForms = (forms) => {
    if (!forms || typeof forms !== 'object') return null;

    const tenses = ['present', 'past', 'future', 'imperative', 'optative'];
    const tenseLabels = {
      present: 'Present (लट्)',
      past: 'Past (लङ्)',
      future: 'Future (लृट्)',
      imperative: 'Imperative (लोट्)',
      optative: 'Optative (लिङ्)',
    };

    const persons = ['first_person', 'second_person', 'third_person'];
    const personLabels = {
      first_person: '1st Person',
      second_person: '2nd Person',
      third_person: '3rd Person',
    };

    const numbers = ['singular', 'dual', 'plural'];

    return (
      <div className="word-analysis-forms">
        <h4 className="word-analysis-forms-title">Verb Forms</h4>
        {tenses.map(tense => {
          const tenseForms = forms[tense];
          if (!tenseForms) return null;

          return (
            <div key={tense} className="word-analysis-verb-tense">
              <h5 className="word-analysis-tense-title">{tenseLabels[tense]}</h5>
              <div className="word-analysis-verb-table-container">
                <table className="word-analysis-verb-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      {numbers.map(num => (
                        <th key={num}>{num.charAt(0).toUpperCase() + num.slice(1)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {persons.map(person => (
                      <tr key={person}>
                        <td className="word-analysis-person-label">{personLabels[person]}</td>
                        {numbers.map(num => {
                          const form = tenseForms[`${person}_${num}`];
                          return (
                            <td key={num} className="word-analysis-form-cell">
                              {form || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Calculate modal position - always centered
  const getModalStyle = () => {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  };

  return createPortal(
    <div className="word-analysis-modal-overlay" onClick={onClose}>
      <div
        className="word-analysis-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={getModalStyle()}
      >
        <button className="word-analysis-modal-close" onClick={onClose}>
          ×
        </button>

        <div className="word-analysis-header">
          <h3 className="word-analysis-word">{word}</h3>
        </div>

        {isLoading && (
          <div className="word-analysis-loading">
            <div className="word-analysis-spinner"></div>
            <p>Analyzing word...</p>
          </div>
        )}

        {error && (
          <div className="word-analysis-error">
            <p>{error}</p>
          </div>
        )}

        {analysis && !isLoading && !error && (
          <div className="word-analysis-body">
            <div className="word-analysis-info">
              <div className="word-analysis-info-item">
                <span className="word-analysis-label">Part of Speech:</span>
                <span className="word-analysis-value">{analysis.part_of_speech || 'N/A'}</span>
              </div>
              {analysis.root && (
                <div className="word-analysis-info-item">
                  <span className="word-analysis-label">Root:</span>
                  <span className="word-analysis-value">{analysis.root}</span>
                </div>
              )}
              {analysis.gender && (
                <div className="word-analysis-info-item">
                  <span className="word-analysis-label">Gender:</span>
                  <span className="word-analysis-value">{analysis.gender}</span>
                </div>
              )}
              {analysis.meaning && (
                <div className="word-analysis-info-item">
                  <span className="word-analysis-label">Meaning:</span>
                  <span className="word-analysis-value">{analysis.meaning}</span>
                </div>
              )}
            </div>

            {analysis.forms && (
              <>
                {hasNounStructure(analysis.forms) && renderNounForms(analysis.forms)}
                {!hasNounStructure(analysis.forms) && hasVerbStructure(analysis.forms) && renderVerbForms(analysis.forms)}
                {!hasNounStructure(analysis.forms) && !hasVerbStructure(analysis.forms) && (
                  <div className="word-analysis-forms">
                    <p>Forms data available but display not implemented for this part of speech.</p>
                    <pre>{JSON.stringify(analysis.forms, null, 2)}</pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default WordAnalysisModal;

