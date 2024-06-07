import React from 'react';
import Flashcard from './Flashcard';

const flashcards = [
  {
    title: `परपतेद्द्यौः सनक्षत्रा पृथिवी श्कली भवेत |` + '\n' +
    `शैत्यमग्निः इयान्न अहं त्यजेयं रघुनन्दनम् ||`,
    content: `Transliteration (IAST):
    prapateddyauḥ sanakṣatrā pṛthivī śakalī bhavet |
    śaityam agniḥ iyān na ahaṃ tyajeyaṃ raghunandanam ||
    
    Translation:
    Even if the sky falls along with the stars, and the Earth shatters into pieces,
    And fire loses its heat, I will never abandon Raghunandana (Lord Rama).
    
    This verse expresses unwavering devotion and loyalty, highlighting that no matter how extreme the circumstances, the speaker's dedication to Lord Rama will remain steadfast.`,
    tags: ['Ramayana']
  }
  // Add more flashcards as needed
];

const Flashcards = () => {
  return (
    <div className="flashcards-list">
      {flashcards.map((flashcard, index) => (
        <Flashcard key={index} flashcard={flashcard} />
      ))}
    </div>
  );
};

export default Flashcards;