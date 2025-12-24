import './App.css';
import './Modal.css';
import './tabs.css';
import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Dictionary from './components/dictionary/Dictionary';
import RamayanaExplore from './components/ramayana/RamayanaExplore';
import Hitopadesa from './components/hitopadesa/Hitopadesa';
import Pancatantra from './components/pancatantra/Pancatantra';
import BhagavadGita from './components/bhagavad_gita/BhagavadGita';
import AdityaHridaya from './components/aditya_hridaya/AdityaHridaya';
import Footer from './components/Footer';
import SignInButton from './components/auth/SignInButton';

// Stotra viewer component
function StotraViewer() {
  const stotras = [
    { id: 'aditya_hridaya', name: 'आदित्यहृदयम्', nameEn: 'Aditya Hridaya Stotra', path: 'aditya-hridaya' }
  ];

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>स्तोत्राणि | Stotras</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {stotras.map((stotra) => (
          <Link
            key={stotra.id}
            to={`/stotras/${stotra.path}`}
            style={{
              padding: '1rem 1.5rem',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
              fontSize: '1rem',
              textDecoration: 'none',
              display: 'block'
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
          </Link>
        ))}
      </div>
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
  
  // Track sidebar collapse state (false = expanded, true = collapsed)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Get current location for active tab styling
  const location = useLocation();

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

  // Helper function to check if a route is active
  const isActiveRoute = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Route configuration
  const routes = [
    { path: '/dictionary', label: 'शब्दकोशः | Dictionary', component: Dictionary, exact: false },
    { path: '/ramayana', label: 'रामायणम् | Ramayana', component: RamayanaExplore, exact: false },
    { path: '/hitopadesa', label: 'हितोपदेशः | Hitopadesa', component: Hitopadesa, exact: false, show: showHitopadesa },
    { path: '/pancatantra', label: 'पञ्चतन्त्रम् | Pancatantra', component: Pancatantra, exact: false, show: showPancatantra },
    { path: '/bhagavad-gita', label: 'भगवद्गीता | Bhagavad Gita', component: BhagavadGita, exact: false },
    { path: '/stotras', label: 'स्तोत्राणि | Stotras', component: StotraViewer, exact: false }
  ];

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
        <div className="react-tabs">
          <div className={`tabs-section ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="heading">
              <span className="devanagari">छात्रः</span>
              <span className="english">A pupil, disciple.</span>
            </div>
            <div className="tabs-wrapper">
              <ul className="react-tabs__tab-list" role="tablist">
                {routes
                  .filter(route => route.show !== false)
                  .map((route) => {
                    const isActive = isActiveRoute(route.path);
                    return (
                      <li
                        key={route.path}
                        className={`react-tabs__tab ${isActive ? 'react-tabs__tab--selected' : ''}`}
                        role="tab"
                        aria-selected={isActive}
                      >
                        <Link
                          to={route.path}
                          data-tooltip={route.path === '/dictionary' ? 'Coming soon' : undefined}
                        >
                          {route.label}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>

          <div className="tab-panel-container">
            <Routes>
              <Route path="/" element={<Navigate to="/ramayana" replace />} />
              <Route path="/dictionary" element={<Dictionary />} />
              <Route path="/ramayana" element={<RamayanaExplore />} />
              {showHitopadesa && <Route path="/hitopadesa" element={<Hitopadesa />} />}
              {showPancatantra && <Route path="/pancatantra" element={<Pancatantra />} />}
              <Route path="/bhagavad-gita" element={<BhagavadGita user={user} token={token} onSignInSuccess={handleSignInSuccess} />} />
              <Route path="/stotras" element={<StotraViewer />} />
              <Route path="/stotras/aditya-hridaya" element={<AdityaHridaya />} />
              <Route path="*" element={<Navigate to="/ramayana" replace />} />
            </Routes>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default App;
