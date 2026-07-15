import React, { useState, useEffect } from 'react';
import { debugLogger } from './utils/debugLogger';
import DebugPanel from './components/DebugPanel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';

// Real pages
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import ItemDetail from './pages/ItemDetail';
import ItemStudio from './pages/ItemStudio';
import Papers from './pages/Papers';
import PaperDetail from './pages/PaperDetail';
import Reviews from './pages/Reviews';
import Templates from './pages/Templates';
import MasterTemplate from './pages/MasterTemplate';
import WizardPage from './pages/WizardPage';
import { CAPSManualLinker } from './components/curriculum/CAPSManualLinker';
import CapsReviewPage from './pages/CapsReviewPage';
import CAPSParserPage from './pages/CAPSParserPage';
import BatchParserDashboard from './pages/BatchParserDashboard';
import ReviewBoard from './pages/ReviewBoard';
import ReviewerDashboard from './pages/ReviewerDashboard';
import AdminAssignmentPanel from './pages/AdminAssignmentPanel';
import QPMemoRegister from './pages/QPMemoRegister';
import ParserImportDashboard from './pages/ParserImportDashboard';
import CapsRegister from './pages/CapsRegister';

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
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [capsParserOpen, setCapsParserOpen] = useState(false);
  const location = useLocation();

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

  const activeLinkStyle: React.CSSProperties = {
    ...linkStyle,
    color: '#ffffff',
    background: '#374151'
  };

  const isReviewActive = location.pathname === '/reviews' || 
                         location.pathname === '/reviewer-dashboard' || 
                         location.pathname === '/review-board';

  const isWizardActive = location.pathname === '/wizard' || 
                         location.pathname === '/batch-parser' ||
                         location.pathname === '/qp-memo-register';

  const isCapsParserActive = location.pathname === '/caps-parser' || 
                             location.pathname === '/caps-register';

  return (
    <nav style={navStyle}>
      <div style={{ fontWeight: 'bold', fontSize: '16px', marginRight: '16px' }}>
        NSC QBank
      </div>
      <Link to="/" style={location.pathname === '/' ? activeLinkStyle : linkStyle}>Dashboard</Link>
      <Link to="/items" style={location.pathname === '/items' ? activeLinkStyle : linkStyle}>Items</Link>
      <Link to="/papers" style={location.pathname === '/papers' ? activeLinkStyle : linkStyle}>Papers</Link>

      {/* Reviews Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setReviewsOpen(!reviewsOpen)}
          onMouseEnter={() => setReviewsOpen(true)}
          style={{
            ...linkStyle,
            ...(isReviewActive ? activeLinkStyle : {}),
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          Reviews
          <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: reviewsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>â–¼</span>
        </button>
        {reviewsOpen && (
          <div 
            onMouseLeave={() => setReviewsOpen(false)}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              background: '#1f2937',
              borderRadius: '4px',
              padding: '8px 0',
              minWidth: '180px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              zIndex: 1000
            }}
          >
            <Link to="/reviews" onClick={() => setReviewsOpen(false)} style={{ ...linkStyle, display: 'block', padding: '8px 16px', fontSize: '13px' }}>Review Board</Link>
            <Link to="/reviewer-dashboard" onClick={() => setReviewsOpen(false)} style={{ ...linkStyle, display: 'block', padding: '8px 16px', fontSize: '13px' }}>Item Review</Link>
          </div>
        )}
      </div>

      <Link to="/templates" style={location.pathname === '/templates' ? activeLinkStyle : linkStyle}>Templates</Link>
      <Link to="/master-template" style={location.pathname === '/master-template' ? activeLinkStyle : linkStyle}>Master Template</Link>

      {/* Wizard Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setWizardOpen(!wizardOpen)}
          onMouseEnter={() => setWizardOpen(true)}
          style={{
            ...linkStyle,
            ...(isWizardActive ? activeLinkStyle : {}),
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          Wizard
          <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: wizardOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>â–¼</span>
        </button>
        {wizardOpen && (
          <div 
            onMouseLeave={() => setWizardOpen(false)}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              background: '#1f2937',
              borderRadius: '4px',
              padding: '8px 0',
              minWidth: '200px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              zIndex: 1000
            }}
          >
            <Link to="/wizard" onClick={() => setWizardOpen(false)} style={{ ...linkStyle, display: 'block', padding: '8px 16px', fontSize: '13px' }}>Import Wizard</Link>
            <Link to="/batch-parser" onClick={() => setWizardOpen(false)} style={{ ...linkStyle, display: 'block', padding: '8px 16px', fontSize: '13px' }}>Batch Parser</Link>
            <Link to="/qp-memo-register" onClick={() => setWizardOpen(false)} style={{ ...linkStyle, display: 'block', padding: '8px 16px', fontSize: '13px' }}>QP & Memo Register</Link>
            <Link to="/parser-import-dashboard" onClick={() => setWizardOpen(false)} style={{ ...linkStyle, display: 'block', padding: '8px 16px', fontSize: '13px' }}>Parser Import Dashboard</Link>
          </div>
        )}
      </div>

      <Link to="/caps-linker" style={location.pathname === '/caps-linker' ? activeLinkStyle : linkStyle}>CAPS Linker</Link>
      <Link to="/caps-review" style={location.pathname === '/caps-review' ? activeLinkStyle : linkStyle}>CAPS Review</Link>

      {/* CAPS Parser Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setCapsParserOpen(!capsParserOpen)}
          onMouseEnter={() => setCapsParserOpen(true)}
          style={{
            ...linkStyle,
            ...(isCapsParserActive ? activeLinkStyle : {}),
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          CAPS Parser
          <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: capsParserOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>&#9660;</span>
        </button>
        {capsParserOpen && (
          <div
            onMouseLeave={() => setCapsParserOpen(false)}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              background: '#1f2937',
              borderRadius: '4px',
              padding: '8px 0',
              minWidth: '200px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              zIndex: 1000
            }}
          >
            <Link to="/caps-parser" onClick={() => setCapsParserOpen(false)} style={{ ...linkStyle, display: 'block', padding: '8px 16px', fontSize: '13px' }}>CAPS Parser</Link>
            <Link to="/caps-register" onClick={() => setCapsParserOpen(false)} style={{ ...linkStyle, display: 'block', padding: '8px 16px', fontSize: '13px' }}>CAPS Register</Link>
          </div>
        )}
      </div>
      {userRole === 'admin' && (
        <Link to="/admin" style={location.pathname === '/admin' ? activeLinkStyle : linkStyle}>Admin</Link>
      )}
      <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>
        Role: {userRole}
      </div>
    </nav>
  );
};

// ============================================
// PLACEHOLDER PAGES
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
      <QueryClientProvider client={new QueryClient()}><BrowserRouter>
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
                <Route path="/items/:id/edit" element={<ItemStudio />} />
                <Route path="/items/:id" element={<ItemDetail />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/reviewer-dashboard" element={<ReviewerDashboard />} />
                <Route path="/review-board" element={<ReviewBoard />} />
                <Route path="/papers" element={<Papers />} />
                <Route path="/papers/:id" element={<PaperDetail />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/master-template" element={<MasterTemplate />} />
                <Route path="/wizard" element={<WizardPage />} />
                <Route path="/batch-parser" element={<BatchParserDashboard />} />
                <Route path="/qp-memo-register" element={<QPMemoRegister />} />
                <Route path="/parser-import-dashboard" element={<ParserImportDashboard />} />
                <Route path="/caps-register" element={<CapsRegister />} />
                <Route path="/caps-linker" element={<CAPSManualLinker />} />
                <Route path="/caps-review" element={<CapsReviewPage />} />
                <Route path="/caps-parser" element={<CAPSParserPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/assignments" element={<AdminAssignmentPanel />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </React.Suspense>
          </main>
          <DebugPanel />
        </div>
      </BrowserRouter></QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;



