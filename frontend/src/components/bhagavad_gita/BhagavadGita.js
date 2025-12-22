import React from 'react';
import CorpusViewer from '../corpus/CorpusViewer';

function BhagavadGita({ user, token }) {
  return (
    <div>
      <CorpusViewer 
        corpusName="bhagavad_gita" 
        versesPerPage={5}
        user={user}
        token={token}
      />
    </div>
  );
}

export default BhagavadGita;
