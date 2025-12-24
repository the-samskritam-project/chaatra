import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CorpusViewer from '../corpus/CorpusViewer';

function Hitopadesa() {
  const navigate = useNavigate();
  const location = useLocation();
  const showBackButton = location.pathname.startsWith('/katha/');

  return (
    <div>
      {showBackButton && (
        <button
          onClick={() => navigate('/katha')}
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
          ← Back to Fables
        </button>
      )}
      <CorpusViewer corpusName="hitopadesa" />
    </div>
  );
}

export default Hitopadesa;

