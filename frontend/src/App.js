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

// Stotra viewer component
function StotraViewer({ selectedStotra, onSelectStotra }) {
  const stotras = [
    { id: 'aditya_hridaya', name: 'आदित्यहृदयम्', nameEn: 'Aditya Hridaya Stotra', component: AdityaHridaya }
  ];

  if (!selectedStotra) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>स्तोत्राणि | Stotras</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {stotras.map((stotra) => (
            <button
              key={stotra.id}
              onClick={() => onSelectStotra(stotra.id)}
              style={{
                padding: '1rem 1.5rem',
                background: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                fontSize: '1rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0f8ff';
                e.currentTarget.style.borderColor = '#007bff';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <div style={{ fontWeight: 600, color: '#007bff', marginBottom: '0.25rem' }}>
                {stotra.name}
              </div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>
                {stotra.nameEn}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selected = stotras.find(s => s.id === selectedStotra);
  if (!selected) return null;

  const Component = selected.component;
  return (
    <div>
      <button
        onClick={() => onSelectStotra(null)}
        style={{
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          background: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          color: '#666'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#e0e0e0';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#f5f5f5';
        }}
      >
        ← Back to Stotras
      </button>
      <Component />
    </div>
  );
}

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
  
  // Track Stotra sub-item selection
  const [selectedStotra, setSelectedStotra] = useState(null);

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
                <Tab>स्तोत्राणि | Stotras</Tab>
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
              <StotraViewer selectedStotra={selectedStotra} onSelectStotra={setSelectedStotra} />
            </TabPanel>
          </div>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}

export default App;
