import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';

// Real pages
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import ItemDetail from './pages/ItemDetail';
import Papers from './pages/Papers';
import PaperDetail from './pages/PaperDetail';
import Reviews from './pages/Reviews';
import Templates from './pages/Templates';
import WizardPage from './pages/WizardPage';

// ============================================
// TYPES
// ============================================
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface PlaceholderProps {
  title: string;
}

// ============================================
// ERROR BOUNDARY
// ============================================
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('QBank Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '40px', 
          fontFamily: 'system-ui, sans-serif',
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <h1 style={{ color: '#dc2626', marginBottom: '16px' }}>
            Something went wrong
          </h1>
          <p style={{ marginBottom: '16px', color: '#374151' }}>
            The application encountered an error. Please try refreshing the page.
          </p>
          <details style={{ 
            background: '#f3f4f6', 
            padding: '16px', 
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Error details (for support)
            </summary>
            <pre style={{ 
              marginTop: '12px', 
              whiteSpace: 'pre-wrap',
              color: '#dc2626',
              fontSize: '12px'
            }}>
              {this.state.error?.toString()}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================
// LOADING FALLBACK
// ============================================
const LoadingFallback: React.FC = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '16px',
    color: '#333'
  }}>
    <div>
      <div style={{ marginBottom: '12px', textAlign: 'center' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '4px solid #e5e7eb', 
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }} />
      </div>
      <p>Loading QBank...</p>
    </div>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// ============================================
// NAVIGATION
// ============================================
const Navigation: React.FC = () => {
  const [userRole, setUserRole] = useState('author');

  useEffect(() => {
    const storedRole = localStorage.getItem('qbank_role') || 'author';
    setUserRole(storedRole);
  }, []);

  const navStyle: React.CSSProperties = {
    display: 'flex',
    gap: '24px',
    padding: '12px 24px',
    background: '#1f2937',
    color: 'white',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
    alignItems: 'center'
  };

  const linkStyle: React.CSSProperties = {
    color: '#d1d5db',
    textDecoration: 'none',
    padding: '4px 8px',
    borderRadius: '4px'
  };

  return (
    <nav style={navStyle}>
      <div style={{ fontWeight: 'bold', fontSize: '16px', marginRight: '16px' }}>
        NSC QBank
      </div>
      <Link to="/" style={linkStyle}>Dashboard</Link>
      <Link to="/items" style={linkStyle}>Items</Link>
      <Link to="/papers" style={linkStyle}>Papers</Link>
      <Link to="/reviews" style={linkStyle}>Reviews</Link>
      <Link to="/templates" style={linkStyle}>Templates</Link>
      <Link to="/wizard" style={linkStyle}>Wizard</Link>
      {userRole === 'admin' && (
        <Link to="/admin" style={linkStyle}>Admin</Link>
      )}
      <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>
        Role: {userRole}
      </div>
    </nav>
  );
};

// ============================================
// PLACEHOLDER PAGES (for routes not yet built)
// ============================================
const PlaceholderPage: React.FC<PlaceholderProps> = ({ title }) => (
  <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>{title}</h1>
    <p style={{ color: '#6b7280' }}>This page is under construction.</p>
    <Link to="/" style={{
      display: 'inline-block',
      marginTop: '20px',
      padding: '10px 20px',
      background: '#3b82f6',
      color: 'white',
      textDecoration: 'none',
      borderRadius: '6px',
    }}>
      Back to Dashboard
    </Link>
  </div>
);

const AdminPage: React.FC = () => <PlaceholderPage title="Admin" />;

// ============================================
// MAIN APP
// ============================================
const App: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    fetch('/api/lookup/lookup_subjects')
      .then(() => setApiStatus('connected'))
      .catch(() => setApiStatus('disconnected'));
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navigation />

          {apiStatus === 'disconnected' && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              padding: '12px 24px',
              fontSize: '13px',
              color: '#92400e',
              fontFamily: 'system-ui, sans-serif'
            }}>
              <strong>Warning:</strong> Cannot connect to backend API. 
              Ensure the backend is running on port 4000.
            </div>
          )}

          <main style={{ flex: 1, overflow: 'auto', background: '#f9fafb' }}>
            <React.Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/items" element={<Items />} />
                <Route path="/items/:id" element={<ItemDetail />} />
               <Route path="/reviews" element={<Reviews />} />
                <Route path="/papers" element={<Papers />} />
                <Route path="/papers/:id" element={<PaperDetail />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/wizard" element={<WizardPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </React.Suspense>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;


