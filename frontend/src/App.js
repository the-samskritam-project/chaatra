import './App.css';
import './Modal.css';
import { Tabs, TabList, Tab, TabPanel } from 'react-tabs';
import './tabs.css';
import Dictionary from './components/dictionary/Dictionary';
import Flashcards from './components/flashcards/Flashcards';
import RamayanaExplore from './components/ramayana/RamayanaExplore';
import Hitopadesa from './components/hitopadesa/Hitopadesa';
import Pancatantra from './components/pancatantra/Pancatantra';
import BhagavadGita from './components/bhagavad_gita/BhagavadGita';
import Footer from './components/Footer';

function App() {
  // Check if Hitopadesa tab should be visible
  const showHitopadesa = process.env.REACT_APP_SHOW_HITOPADESA === 'true';
  // Pancatantra is always visible (or can be controlled via env var if needed)
  const showPancatantra = process.env.REACT_APP_SHOW_PANCATANTRA !== 'false';

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
                <Tab data-tooltip="Coming soon">
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
                {showHitopadesa && <Tab>Hitopadesa</Tab>}
                {showPancatantra && <Tab>Pancatantra</Tab>}
                <Tab>Bhagavad Gita</Tab>
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
              <RamayanaExplore />
            </TabPanel>

            {showHitopadesa && (
              <TabPanel>
                <Hitopadesa />
              </TabPanel>
            )}
            {showPancatantra && (
              <TabPanel>
                <Pancatantra />
              </TabPanel>
            )}
            <TabPanel>
              <BhagavadGita />
            </TabPanel>
          </div>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}

export default App;
