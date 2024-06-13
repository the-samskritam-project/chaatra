import './App.css';
import './Modal.css';
import Dictionary from './components/dictionary/Dictionary';
import Heading from './Heading';
import { Tabs, TabList, Tab, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import Flashcards from './components/flashcards/Flashcards';

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
          <Flashcards />
        </TabPanel>

      </Tabs>
    </div>
  );
}

export default App;
