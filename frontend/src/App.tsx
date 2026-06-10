import React, { useState } from 'react';
import UploadWizard from './components/wizard/UploadWizard';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'dashboard'>('upload');

  return (
    <div className="app">
      <header className="app-header">
        <h1>QBank Corporate System</h1>
        <p>Question Paper Validation & Comparison Engine</p>
        <nav className="app-nav">
          <button 
            className={activeTab === 'upload' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveTab('upload')}
          >
            📄 Upload & Validate
          </button>
          <button 
            className={activeTab === 'dashboard' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
        </nav>
      </header>
      <main>
        {activeTab === 'upload' && <UploadWizard />}
        {activeTab === 'dashboard' && <Dashboard />}
      </main>

      <style>{`{
        .app {
          min-height: 100vh;
          background: #f5f5f5;
        }
        .app-header {
          background: #1a1a2e;
          color: white;
          padding: 15px 20px;
          text-align: center;
        }
        .app-header h1 {
          margin: 0 0 5px 0;
          font-size: 22px;
        }
        .app-header p {
          margin: 0 0 15px 0;
          opacity: 0.8;
          font-size: 14px;
        }
        .app-nav {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 10px;
        }
        .nav-btn {
          background: transparent;
          color: white;
          border: 2px solid rgba(255,255,255,0.3);
          padding: 8px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .nav-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.5);
        }
        .nav-btn.active {
          background: #3498db;
          border-color: #3498db;
        }
        main {
          padding: 20px;
        }
      }`}</style>
    </div>
  );
};

export default App;
