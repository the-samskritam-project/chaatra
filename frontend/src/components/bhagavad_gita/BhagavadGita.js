import React, { useState, useEffect } from 'react';
import CorpusViewer from '../corpus/CorpusViewer';
import DictionaryLookup from '../dictionary/DictionaryLookup';

function BhagavadGita({ user, token, onSignInSuccess }) {
  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    const url = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';
    setApiUrl(url);
  }, []);

  return (
    <div>
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
