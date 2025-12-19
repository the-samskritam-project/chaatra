import React from 'react';
import CorpusViewer from '../corpus/CorpusViewer';

function BhagavadGita() {
  return (
    <div>
      <CorpusViewer 
        corpusName="bhagavad_gita" 
        versesPerPage={5}
      />
    </div>
  );
}

export default BhagavadGita;
