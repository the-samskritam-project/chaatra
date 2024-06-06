import './App.css';
import Dictionary from './Dictionary';
import Heading from './Heading';
import { Tabs, TabList, Tab, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import Flashcards from './Flashcards';

const flashcardsData = [
  {
    title: 'Flashcard 1',
    content: 'This is the content of flashcard 1.',
    tags: ['tag1', 'tag2']
  },
  {
    title: 'Flashcard 2',
    content: 'This is the content of flashcard 2.',
    tags: ['tag3', 'tag4']
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
