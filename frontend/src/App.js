import './App.css';
import './Modal.css';
import { Tabs, TabList, Tab, TabPanel } from 'react-tabs';
import './tabs.css';
import Dictionary from './components/dictionary/Dictionary';
import Flashcards from './components/flashcards/Flashcards';
import RamayanaSearch from './components/ramayana/RamayanaSearch';

function App() {
  return (
    <div>
      <div className="tabs-container">
        <Tabs defaultIndex={2}>
          <div className="tabs-section">
            <div className="heading">
              <span className="devanagari">छात्रः</span>
              <span className="english">A pupil, disciple.</span>
            </div>
            <div className="tabs-wrapper">
              <TabList>
                <Tab
                  className="react-tabs__tab tab-coming-soon"
                  disabled
                  data-tooltip="Coming soon"
                >
                  Dictionary
                </Tab>
                <Tab
                  className="react-tabs__tab tab-coming-soon"
                  disabled
                  data-tooltip="Coming soon"
                >
                  Flash cards
                </Tab>
                <Tab>Ramayana</Tab>
              </TabList>
            </div>
          </div>

          <div className="tab-panel-container">
            <TabPanel>
              <Dictionary />
            </TabPanel>

            <TabPanel>
              <Flashcards />
            </TabPanel>

            <TabPanel>
              <RamayanaSearch />
            </TabPanel>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
