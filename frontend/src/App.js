import './App.css';
import './Modal.css';
import { Tabs, TabList, Tab, TabPanel } from 'react-tabs';
import './tabs.css';
import { useState, useEffect } from 'react';
import Dictionary from './components/dictionary/Dictionary';
import RamayanaExplore from './components/ramayana/RamayanaExplore';
import Hitopadesa from './components/hitopadesa/Hitopadesa';
import Pancatantra from './components/pancatantra/Pancatantra';
import BhagavadGita from './components/bhagavad_gita/BhagavadGita';
import AdityaHridaya from './components/aditya_hridaya/AdityaHridaya';
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
  
  // Track sidebar collapse state (false = expanded, true = collapsed)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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

  // Sidebar collapse state (simple boolean)
  const sidebarCollapsed = isSidebarCollapsed;
  
  // Toggle sidebar collapse
  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
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
        <Tabs selectedIndex={selectedIndex} onSelect={(index) => setSelectedIndex(index)}>
          <div className={`tabs-section ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="heading">
              <span className="devanagari">छात्रः</span>
              <span className="english">A pupil, disciple.</span>
            </div>
            <div className="tabs-wrapper">
              <TabList>
                <Tab data-tooltip="Coming soon">
                  शब्दकोशः | Dictionary
                </Tab>
                <Tab>रामायणम् | Ramayana</Tab>
                {showHitopadesa && <Tab>हितोपदेशः | Hitopadesa</Tab>}
                {showPancatantra && <Tab>पञ्चतन्त्रम् | Pancatantra</Tab>}
                <Tab>भगवद्गीता | Bhagavad Gita</Tab>
                <Tab>आदित्यहृदयम् | Aditya Hridaya</Tab>
              </TabList>
            </div>
          </div>

          <div className="tab-panel-container">
            <TabPanel>
              <Dictionary />
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
            <TabPanel>
              <AdityaHridaya />
            </TabPanel>
          </div>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}

export default App;
