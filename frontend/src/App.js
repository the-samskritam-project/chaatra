import './App.css';
import './Modal.css';
import { Tabs, TabList, Tab, TabPanel } from 'react-tabs';
import './tabs.css';
import { useState, useEffect } from 'react';
import Dictionary from './components/dictionary/Dictionary';
import Flashcards from './components/flashcards/Flashcards';
import RamayanaExplore from './components/ramayana/RamayanaExplore';
import Hitopadesa from './components/hitopadesa/Hitopadesa';
import Pancatantra from './components/pancatantra/Pancatantra';
import BhagavadGita from './components/bhagavad_gita/BhagavadGita';
import Footer from './components/Footer';
import SignInButton from './components/auth/SignInButton';

function App() {
  // Check if Hitopadesa tab should be visible
  const showHitopadesa = process.env.REACT_APP_SHOW_HITOPADESA === 'true';
  // Pancatantra is always visible (or can be controlled via env var if needed)
  const showPancatantra = process.env.REACT_APP_SHOW_PANCATANTRA !== 'false';

  // Auth state management
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [apiUrl, setApiUrl] = useState('');
  
  // Track selected tab index
  const [selectedIndex, setSelectedIndex] = useState(2);
  
  // Track manual sidebar collapse state (null = auto, true/false = manual override)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(null);

  // Load auth data from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error loading auth data:', error);
        // Clear invalid data
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }

    // Set API URL
    const url = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:8081';
    setApiUrl(url);
  }, []);

  // Handle successful sign-in
  const handleSignInSuccess = (result) => {
    setToken(result.token);
    setUser(result.user);
    
    // Store in localStorage
    localStorage.setItem('auth_token', result.token);
    localStorage.setItem('auth_user', JSON.stringify(result.user));
  };

  // Handle sign-out
  const handleSignOut = () => {
    setToken(null);
    setUser(null);
    
    // Clear from localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  // Calculate Bhagavad Gita tab index
  // Tab order: Dictionary (0), Flash cards (1), Ramayana (2), Hitopadesa (3 if shown), Pancatantra (varies), Bhagavad Gita (last)
  const bhagavadGitaIndex = 3 + (showHitopadesa ? 1 : 0) + (showPancatantra ? 1 : 0);
  const isBhagavadGitaActive = selectedIndex === bhagavadGitaIndex;
  
  // Reset manual state when switching to Bhagavad Gita (so it auto-collapses)
  useEffect(() => {
    if (isBhagavadGitaActive) {
      setIsSidebarCollapsed(null); // Reset to allow auto-collapse
    }
  }, [isBhagavadGitaActive]);
  
  // Sidebar is collapsed if:
  // - Bhagavad Gita is active AND not manually expanded, OR
  // - Manually collapsed when on other tabs
  const sidebarCollapsed = isBhagavadGitaActive 
    ? (isSidebarCollapsed !== false)  // Collapsed by default, but allow manual expand
    : (isSidebarCollapsed === true); // Use manual state on other tabs
  
  // Toggle sidebar collapse
  const toggleSidebar = () => {
    if (isBhagavadGitaActive) {
      // On Bhagavad Gita, toggle between collapsed (default) and expanded (manual override)
      setIsSidebarCollapsed(isSidebarCollapsed === false ? null : false);
    } else {
      // On other tabs, toggle manual state
      setIsSidebarCollapsed(isSidebarCollapsed === true ? false : true);
    }
  };

  return (
    <div>
      <SignInButton user={user} onSignInSuccess={handleSignInSuccess} onSignOut={handleSignOut} apiUrl={apiUrl} />
      <div className={`tabs-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <button 
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '▶' : '◀'}
        </button>
        <Tabs defaultIndex={2} selectedIndex={selectedIndex} onSelect={(index) => setSelectedIndex(index)}>
          <div className={`tabs-section ${sidebarCollapsed ? 'collapsed' : ''}`}>
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
              <BhagavadGita user={user} token={token} onSignInSuccess={handleSignInSuccess} />
            </TabPanel>
          </div>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}

export default App;
