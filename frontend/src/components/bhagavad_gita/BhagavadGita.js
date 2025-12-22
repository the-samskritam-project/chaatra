import React from 'react';
import CorpusViewer from '../corpus/CorpusViewer';

function BhagavadGita({ user, token, onSignInSuccess }) {
  return (
    <div>
      <CorpusViewer 
        corpusName="bhagavad_gita" 
        versesPerPage={5}
        user={user}
        token={token}
        onSignInSuccess={onSignInSuccess}
      />
    </div>
  );
}

export default BhagavadGita;
