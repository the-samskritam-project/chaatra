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
      <div className="tabs-container">
        <Tabs>
          <div className="tabs-section">
            <div className="heading">
              <span className="devanagari">छात्रः</span>
              <span className="english">A pupil, disciple.</span>
            </div>
            <div className="tabs-wrapper">
              <TabList>
                <Tab>Dictionary</Tab>
                <Tab>Flash cards</Tab>
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
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
