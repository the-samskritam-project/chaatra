import './App.css';
import Dictionary from './Dictionary';
import Heading from './Heading';
import { Tabs, TabList, Tab, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import Flashcards from './Flashcards';

const flashcardsData = [
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

function App() {
  return (
    <div className="main-container">
      <Heading />

      <Tabs>       
        <TabList>
          <Tab>Dictionary</Tab>
          <Tab>Flash cards</Tab>
        </TabList>

        <TabPanel>
          <Dictionary />
        </TabPanel>

        <TabPanel>
          <Flashcards flashcards={flashcardsData} />
        </TabPanel>

      </Tabs>
    </div>
  );
}

export default App;
