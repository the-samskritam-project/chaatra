import './App.css';
import './Modal.css';
import Dictionary from './components/dictionary/Dictionary';
import Heading from './Heading';
import { Tabs, TabList, Tab, TabPanel } from 'react-tabs';
import './tabs.css';
import Flashcards from './components/flashcards/Flashcards';

function App() {
  return (
    <div>
      <Heading />

      <div className="tabs-container">
        <Tabs>
          <div className="tab-list-container">
            <TabList>
              <Tab>Dictionary</Tab>
              <Tab>Flash cards</Tab>
            </TabList>
          </div>

          <div className="tab-panel-container">
            <TabPanel>
              <Dictionary />
            </TabPanel>

            <TabPanel>
              <Flashcards />
            </TabPanel>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
