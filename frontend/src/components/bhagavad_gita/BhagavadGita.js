import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CorpusViewer from '../corpus/CorpusViewer';
import DictionaryLookup from '../dictionary/DictionaryLookup';

function BhagavadGita({ user, token, onSignInSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();
  const showBackButton = location.pathname.startsWith('/sruti/');
  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    const url = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';
    setApiUrl(url);
  }, []);

  return (
    <div>
      {showBackButton && (
        <button
          onClick={() => navigate('/sruti')}
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
          ← Back to Scriptures
        </button>
      )}
      <CorpusViewer 
        corpusName="bhagavad_gita" 
        versesPerPage={5}
        user={user}
        token={token}
        onSignInSuccess={onSignInSuccess}
      />
      <DictionaryLookup apiUrl={apiUrl} />
    </div>
  );
}

export default BhagavadGita;
